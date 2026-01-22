#!/usr/bin/env python3
"""
Systematic AI Response Quality Testing for SmokeScan.

Tests all 7 fire damage scenarios with proper metadata injection
and captures results for FDAM accuracy evaluation.

Usage:
    python3 test_systematic.py --scenario "Bar Area"   # Single scenario
    python3 test_systematic.py --all                   # All scenarios
    python3 test_systematic.py --list                  # List available scenarios

Requires RUNPOD_API_KEY environment variable.
"""
import os
import sys
import json
import base64
import time
import argparse
from datetime import datetime
from pathlib import Path
import requests

# Configuration
API_KEY = os.environ.get("RUNPOD_API_KEY")
ENDPOINT_ID = os.environ.get("RUNPOD_ANALYSIS_ENDPOINT_ID", "4fu896ozb83lxq")
BASE_URL = f"https://api.runpod.ai/v2/{ENDPOINT_ID}"

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
SAMPLE_IMAGES_DIR = PROJECT_ROOT / "sample_images"
TEST_ROOMS_FILE = PROJECT_ROOT / "seed" / "test-rooms.json"
RESULTS_DIR = Path(__file__).parent / "test-results"

# Image path mapping (verified Jan 21, 2026)
SCENARIO_PATHS = {
    "Bar Area": "Bar Area",
    "Bar and Dining": "Bar and Dining",
    "Bedroom": "Bedroom",
    "Dining Room": "Dining Room",
    "Factory": "Factory",
    "Kitchen": "Kitchen",
    "Living Room": "Living Room",
}


def load_test_rooms() -> dict:
    """Load room metadata from test-rooms.json"""
    with open(TEST_ROOMS_FILE, "r") as f:
        data = json.load(f)

    # Index by room_name for easy lookup
    rooms = {}
    for room in data.get("rooms", []):
        rooms[room["room_name"]] = room
    return rooms


def get_images_for_scenario(scenario: str, max_images: int = 3) -> list:
    """Get image file paths for a scenario"""
    folder = SAMPLE_IMAGES_DIR / SCENARIO_PATHS[scenario]
    if not folder.exists():
        raise FileNotFoundError(f"Scenario folder not found: {folder}")

    # Get all jpg files, sorted
    images = sorted(folder.glob("*.jpg"))
    if not images:
        raise FileNotFoundError(f"No images found in {folder}")

    return images[:max_images]


def load_image_base64(image_path: Path) -> str:
    """Load image and convert to base64 data URI"""
    with open(image_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")

    ext = image_path.suffix.lower()
    mime_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    mime = mime_types.get(ext, "image/jpeg")

    return f"data:{mime};base64,{data}"


def format_metadata(room: dict) -> str:
    """Format room metadata as markdown sections for handler injection"""
    dims = room.get("dimensions", {})
    sensory = room.get("sensory_observations", {})

    # Room Metadata section
    metadata_lines = [
        "## Room Metadata",
        f"- Floor level: {room.get('floor_level', 'unknown')}",
        f"- Dimensions: {dims.get('length_ft', 0)}' L x {dims.get('width_ft', 0)}' W x {dims.get('height_ft', 0)}' H",
        f"- Area: {dims.get('area_sf', 0)} SF",
        f"- Volume: {dims.get('volume_cf', 0)} CF",
    ]

    # Field Observations section
    observation_lines = ["", "## Field Observations"]

    if sensory.get("smoke_odor_present") is not None:
        observation_lines.append(f"- Smoke odor present: {'Yes' if sensory['smoke_odor_present'] else 'No'}")

    if sensory.get("smoke_odor_intensity"):
        observation_lines.append(f"- Smoke odor intensity: {sensory['smoke_odor_intensity']}")

    if sensory.get("white_wipe_result"):
        observation_lines.append(f"- White wipe test result: {sensory['white_wipe_result']}")

    return "\n".join(metadata_lines + observation_lines)


def build_prompt(scenario: str, room: dict, image_count: int) -> str:
    """Build the full prompt with metadata injection"""
    room_type = room.get("room_type", "space")
    structure_type = room.get("structure_type", "structure")

    metadata = format_metadata(room)

    multi_image_note = f"These {image_count} images show different angles of the same space." if image_count > 1 else ""

    prompt = f"""Analyze this fire-damaged {room_type} in a {structure_type} structure.
{multi_image_note}

{metadata}

Provide a complete PRE assessment with zone classification, surface assessment, and disposition recommendations per FDAM methodology."""

    return prompt


def submit_job(payload: dict) -> str:
    """Submit async job to RunPod endpoint, return job ID"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    response = requests.post(
        f"{BASE_URL}/run",
        headers=headers,
        json={"input": payload},
        timeout=30,
    )
    response.raise_for_status()
    result = response.json()

    if "id" not in result:
        raise ValueError(f"No job ID in response: {result}")
    return result["id"]


def poll_job(job_id: str, max_wait: int = 900, interval: int = 10) -> dict:
    """Poll job status until complete or timeout"""
    headers = {"Authorization": f"Bearer {API_KEY}"}
    start_time = time.time()

    while time.time() - start_time < max_wait:
        response = requests.get(
            f"{BASE_URL}/status/{job_id}",
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        result = response.json()
        status = result.get("status")
        elapsed = int(time.time() - start_time)
        print(f"  Status: {status} (elapsed: {elapsed}s)")

        if status == "COMPLETED":
            return {
                "output": result.get("output", {}),
                "elapsed_seconds": elapsed
            }
        elif status == "FAILED":
            return {
                "error": result.get("error", "Unknown error"),
                "elapsed_seconds": elapsed
            }
        elif status in ("IN_QUEUE", "IN_PROGRESS"):
            time.sleep(interval)
        else:
            time.sleep(interval)

    return {"error": f"Timeout after {max_wait}s", "elapsed_seconds": max_wait}


def evaluate_response(response_text: str, expected_zone: str) -> dict:
    """Evaluate response for FDAM accuracy"""
    text_lower = response_text.lower()

    evaluation = {
        "sections_found": {
            "executive_summary": any(x in text_lower for x in ["executive summary", "## 1."]),
            "zone_classification": any(x in text_lower for x in ["zone classification", "## 2."]),
            "surface_assessment": any(x in text_lower for x in ["surface assessment", "## 3."]),
            "disposition": any(x in text_lower for x in ["disposition", "## 4."]),
            "sampling": any(x in text_lower for x in ["sampling", "## 5."]),
        },
        "fdam_compliance": {
            "uses_zone_terminology": any(z in text_lower for z in ["burn zone", "near-field", "far-field", "near field", "far field"]),
            "mentions_ash_char_threshold": "150" in response_text,
            "mentions_aciniform_threshold": "500" in response_text,
            "has_advisory": "advisory" in text_lower or "professional" in text_lower,
        },
        "zone_detected": None,
        "expected_zone": expected_zone,
    }

    # Detect which zone was classified
    if "burn zone" in text_lower:
        evaluation["zone_detected"] = "burn"
    elif "near-field" in text_lower or "near field" in text_lower:
        evaluation["zone_detected"] = "near-field"
    elif "far-field" in text_lower or "far field" in text_lower:
        evaluation["zone_detected"] = "far-field"

    # Calculate scores
    sections_present = sum(evaluation["sections_found"].values())
    fdam_checks_passed = sum(evaluation["fdam_compliance"].values())

    evaluation["scores"] = {
        "sections_complete": f"{sections_present}/5",
        "fdam_compliance": f"{fdam_checks_passed}/4",
    }

    return evaluation


def get_expected_zone(room: dict) -> str:
    """Determine expected zone based on room metadata"""
    sensory = room.get("sensory_observations", {})
    wipe = sensory.get("white_wipe_result", "")

    if wipe == "heavy-deposits":
        return "near-field"
    elif wipe == "moderate-deposits":
        return "near-field"  # Could be either, lean toward near-field
    elif wipe == "light-deposits":
        return "far-field"
    elif wipe == "clean":
        return "no-action"
    return "unknown"


def run_test(scenario: str, rooms: dict, max_images: int = 3, save_results: bool = True) -> dict:
    """Run test for a single scenario"""
    print(f"\n{'='*60}")
    print(f"TESTING: {scenario}")
    print(f"{'='*60}")

    # Get room metadata
    room = rooms.get(scenario)
    if not room:
        return {"scenario": scenario, "error": f"No metadata found for scenario: {scenario}"}

    # Get images
    try:
        image_paths = get_images_for_scenario(scenario, max_images)
    except FileNotFoundError as e:
        return {"scenario": scenario, "error": str(e)}

    print(f"Images: {len(image_paths)}")
    for p in image_paths:
        print(f"  - {p.name}")

    # Build prompt with metadata
    prompt = build_prompt(scenario, room, len(image_paths))
    print(f"\nPrompt preview:\n{prompt[:500]}...")

    # Build payload
    content = []
    for img_path in image_paths:
        data_uri = load_image_base64(img_path)
        content.append({"type": "image", "image": data_uri})
    content.append({"type": "text", "text": prompt})

    payload = {
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 4000,
    }

    # Submit and poll
    print("\nSubmitting job...")
    job_id = None
    try:
        job_id = submit_job(payload)
        print(f"Job ID: {job_id}")
    except Exception as e:
        return {"scenario": scenario, "error": f"Submit failed: {e}"}

    print("\nPolling for result...")
    result = poll_job(job_id)

    # Extract output
    if "error" in result:
        output_text = ""
        error = result["error"]
    else:
        output_data = result.get("output", {})
        output_text = output_data.get("output", "") if isinstance(output_data, dict) else str(output_data)
        error = None

    # Evaluate
    expected_zone = get_expected_zone(room)
    evaluation = evaluate_response(output_text, expected_zone) if output_text else {}

    # Build result record
    test_result = {
        "scenario": scenario,
        "timestamp": datetime.now().isoformat(),
        "config": {
            "image_count": len(image_paths),
            "max_images": max_images,
            "metadata_included": True,
        },
        "room_metadata": room,
        "request": {
            "job_id": job_id,
            "image_files": [p.name for p in image_paths],
            "prompt": prompt,
        },
        "response": {
            "raw_output": output_text,
            "char_count": len(output_text),
            "processing_time_seconds": result.get("elapsed_seconds", 0),
            "error": error,
        },
        "evaluation": evaluation,
    }

    # Save results
    if save_results and output_text:
        save_test_result(scenario, test_result)

    # Print summary
    print(f"\n{'='*60}")
    print("RESULT SUMMARY")
    print(f"{'='*60}")
    if error:
        print(f"ERROR: {error}")
    else:
        print(f"Output length: {len(output_text)} chars")
        print(f"Processing time: {result.get('elapsed_seconds', 0)}s")
        if evaluation:
            print(f"Sections found: {evaluation['scores']['sections_complete']}")
            print(f"FDAM compliance: {evaluation['scores']['fdam_compliance']}")
            print(f"Zone detected: {evaluation.get('zone_detected', 'none')}")
            print(f"Expected zone: {expected_zone}")
        print(f"\nFull output:\n{'-'*40}")
        print(output_text)

    return test_result


def save_test_result(scenario: str, result: dict):
    """Save test result to JSON file"""
    # Create results directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = RESULTS_DIR / timestamp
    results_dir.mkdir(parents=True, exist_ok=True)

    # Sanitize scenario name for filename
    safe_name = scenario.lower().replace(" ", "_")
    result_file = results_dir / f"{safe_name}.json"

    with open(result_file, "w") as f:
        json.dump(result, f, indent=2, default=str)

    print(f"\nResult saved to: {result_file}")


def list_scenarios(rooms: dict):
    """List available test scenarios"""
    print("\nAvailable scenarios:")
    print("-" * 60)
    for name in SCENARIO_PATHS:
        room = rooms.get(name, {})
        wipe = room.get("sensory_observations", {}).get("white_wipe_result", "unknown")
        try:
            images = get_images_for_scenario(name, max_images=100)
            img_count = len(images)
        except FileNotFoundError:
            img_count = 0
        print(f"  {name:<20} | {img_count} images | wipe: {wipe}")


def main():
    parser = argparse.ArgumentParser(description="Systematic AI Response Quality Testing")
    parser.add_argument("--scenario", type=str, help="Run single scenario by name")
    parser.add_argument("--all", action="store_true", help="Run all scenarios")
    parser.add_argument("--list", action="store_true", help="List available scenarios")
    parser.add_argument("--max-images", type=int, default=3, help="Max images per test (default: 3)")
    parser.add_argument("--no-save", action="store_true", help="Don't save results to files")
    args = parser.parse_args()

    if not API_KEY:
        print("ERROR: RUNPOD_API_KEY environment variable not set")
        sys.exit(1)

    # Load room metadata
    try:
        rooms = load_test_rooms()
    except FileNotFoundError:
        print(f"ERROR: Test rooms file not found: {TEST_ROOMS_FILE}")
        sys.exit(1)

    if args.list:
        list_scenarios(rooms)
        return

    if args.scenario:
        if args.scenario not in SCENARIO_PATHS:
            print(f"ERROR: Unknown scenario: {args.scenario}")
            list_scenarios(rooms)
            sys.exit(1)
        run_test(args.scenario, rooms, args.max_images, not args.no_save)

    elif args.all:
        print(f"Running all {len(SCENARIO_PATHS)} scenarios...")
        results = []
        for scenario in SCENARIO_PATHS:
            result = run_test(scenario, rooms, args.max_images, not args.no_save)
            results.append(result)

        # Print summary
        print(f"\n{'='*60}")
        print("ALL TESTS COMPLETE")
        print(f"{'='*60}")
        for r in results:
            status = "ERROR" if r.get("response", {}).get("error") or r.get("error") else "OK"
            eval_data = r.get("evaluation", {})
            zone = eval_data.get("zone_detected", "?")
            expected = eval_data.get("expected_zone", "?")
            print(f"  {r['scenario']:<20} | {status} | zone: {zone} (expected: {expected})")

    else:
        parser.print_help()
        print("\n")
        list_scenarios(rooms)


if __name__ == "__main__":
    main()
