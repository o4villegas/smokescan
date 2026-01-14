## Part 3: Facility Classification

### 3.1 Classification Categories

| Classification | Definition | Lead Threshold | Applicable Standards |
|----------------|------------|----------------|---------------------|
| Operational | OSHA regulated substance used; workers trained; hygiene controls in place | 500 µg/100cm² | BNL SOP IH75190 Operational |
| Non-Operational | No regulated substance use; workers not trained; eating/drinking permitted | 22 µg/100cm² | BNL SOP IH75190 Non-Operational |
| Public-Childcare | Schools, daycare, child-occupied facilities | 0.54 µg/100cm² (floors) | EPA/HUD October 2024 |

### 3.2 Classification Determination

Facility classification is a professional judgment decision documented in the Results Interpretation deliverable. The determination considers:

- Facility use and occupancy type
- Presence of OSHA regulated substances
- Worker training status
- Personal hygiene controls (eating/drinking restrictions, handwashing requirements)
- Occupant populations (children, general public, trained workers)

### 3.3 Regulatory Justification Blocks

**Non-Operational Commercial/Industrial:**

> The indoor environment within [FACILITY] is comparable to the definition of a "Non-Operational Area" per OSHA Technical Manual Section II Chapter 2: an area where an OSHA Regulated Substance is not used and where workers are not trained in hazards and controls. Personal hygiene control practices are not in place (hand washing is not expected on exiting the area) and eating & drinking are permitted.
>
> The applicable standard for measuring cleaning performance is derived from BNL SOP IH75190 "Surface Wipe Sampling for Metals" (Rev23, 06/23/17), which establishes 22 µg/100cm² (≈204 µg/ft²) for Non-Operational areas. This threshold is consistent with the Army and Air Force National Guard "Guidelines and Procedures for Rehabilitation and Conversion of Indoor Firing Ranges" which establishes 200 µg/ft² as acceptable for spaces converted to general use.
>
> OSHA housekeeping provisions (29 CFR 1910.1025, 1910.1018, 1910.1027) require surfaces be maintained "as free as practicable" of accumulations of regulated metals.

**Operational Industrial:**

> [FACILITY] meets the definition of an "Operational Area" per OSHA Technical Manual Section II Chapter 2: an area where workers are routinely in the presence of an OSHA Regulated Substance as part of their work activity. Workers who handle the substance have been trained in hazards and controls. Substances are routinely used, handled or stored and personal hygiene control practices are in place.
>
> The applicable standard is BNL SOP IH75190 Operational threshold of 500 µg/100cm² for lead.

**Public-Childcare:**

> [FACILITY] is classified as a child-occupied facility subject to EPA/HUD Lead Dust Hazard Standards (October 2024). These standards establish protective thresholds for environments where children may be present.
>
> Applicable thresholds: 0.54 µg/100cm² (floors), 4.3 µg/100cm² (window sills and troughs).

---

## Part 4: Surface Assessment

### 4.1 Zone Classification

**Source:** IICRC/RIA/CIRI Technical Guide for Wildfire Restoration (December 2025)

| Zone | Definition | Typical Characteristics |
|------|------------|------------------------|
| Burn Zone | Direct fire involvement | Structural damage, char, complete combustion |
| Near-Field | Adjacent to burn zone, heavy smoke/heat exposure | Heavy soot deposits, heat damage, strong odor |
| Far-Field | Smoke migration without direct heat exposure | Light to moderate deposits, odor, no structural damage |

### 4.2 Condition Scale

| Condition | Visual Indicators |
|-----------|-------------------|
| Background | No visible contamination; equivalent to unaffected areas |
| Light | Faint discoloration; minimal deposits visible on white wipe |
| Moderate | Visible film or deposits; clear contamination on white wipe |
| Heavy | Thick deposits; surface texture obscured; strong odor |
| Structural Damage | Physical damage requiring repair before cleaning |

### 4.3 Disposition Matrix

**Non-Porous Surfaces (Steel, Concrete, Glass, Metal):**

| Zone | Condition | Disposition | Protocol |
|------|-----------|-------------|----------|
| Any | Background | No action | Document only |
| Far-Field | Light | Clean | Standard protocol |
| Far-Field | Moderate | Clean | Full protocol |
| Near-Field | Light | Clean | Full protocol |
| Near-Field | Moderate | Clean | Aggressive protocol, multiple passes |
| Near-Field | Heavy | Clean | Aggressive protocol with verification sampling |
| Burn Zone | Any restorable | Clean | Post-structural repair; aggressive protocol |
| Any | Structural Damage | Remove/Repair | Beyond cleaning scope |

**Porous/Semi-Porous Surfaces (Drywall, Carpet, Insulation, Acoustic Tile):**

| Zone | Condition | Disposition | Rationale |
|------|-----------|-------------|-----------|
| Far-Field | Background | Evaluate | May clean if truly superficial |
| Far-Field | Light | Evaluate/Clean | Assessment determines restorability |
| Far-Field | Moderate+ | Remove | Porous materials absorb contaminants |
| Near-Field | Light+ | Remove | Porous materials absorb contaminants and VOCs |
| Burn Zone | Any | Remove | Cannot effectively decontaminate |

### 4.4 Material Disposition Categories

**Tier 1: Generally Replace When Fire/Smoke Affected**

| Material | Rationale |
|----------|-----------|
| Fiberglass insulation | Absorbs particulates and VOCs into fiber matrix |
| Flexible ductwork | Interior lining absorbs contaminants; cannot effectively clean |
| HVAC duct interior insulation | Porous material in air pathway; recontamination risk |
| Mattresses and bedding | Multi-layer foam construction; deep penetration |

**Tier 2: Assess Based on Condition**

| Material | Clean When | Remove When |
|----------|------------|-------------|
| Carpet and pad | Far-Field, Light | Near-Field, Moderate+ |
| Drop ceiling tile | Far-Field, Light, smooth | Near-Field, or textured/acoustic |
| Drywall (painted) | Far-Field, Light | Near-Field Moderate+, or unpainted |
| Upholstered furniture | Far-Field, Light, high value | Near-Field, or low value |

**Tier 3: Generally Cleanable**

| Material | Standard Protocol |
|----------|-------------------|
| Structural steel | HEPA vac → wet wipe → rinse |
| Concrete (sealed) | Scrubber or power wash |
| Metal doors/frames | Wet wipe → rinse |
| Glass/windows | Wet wipe → squeegee |
| Smooth rigid ductwork | Per NADCA ACR |

### 4.5 Ceiling Deck Protocol

Empirical data indicates ceiling deck surfaces require enhanced attention:

**Finding:** 82.4% pass rate for ceiling decks vs 95%+ for other structural surfaces (n=45, QVC dataset)

**Requirements:**
- Increase PRV sample density by 50%
- Consider additional cleaning pass before PRV
- Document access method and cleaning thoroughness
- Priority surface for reclean if failures occur

### 4.6 Secondary Contamination

If fungal/mold growth is identified during fire damage assessment:
- Document presence, type, and extent
- Cross-reference IICRC S520 for remediation protocols
- Address fire damage and biological contamination as separate scopes
- Sequential remediation may be required (mold first if active growth)

---

## Part 5: Cleaning Protocol Framework

### 5.1 Standard Cleaning Sequence

```
Step 1: HEPA Vacuum
        └── Remove loose particulate from all surfaces
        
Step 2: Dry Sponge (if needed)
        └── Chemical sponge for char/soot on non-porous surfaces
        
Step 3: Wet Wipe - Alkaline Detergent
        └── pH 10-12 solution for chemical residue removal
        
Step 4: Rinse Wipe
        └── Clean water to remove detergent residue
        
Step 5: Degreaser (if needed)
        └── For stubborn residues not removed by standard protocol
```

**Sequencing Rule:** Clean top-down (roof deck → structure → walls → floor) to prevent recontamination.

### 5.2 Surface-Specific Methods

| Surface Type | Standard Method |
|--------------|-----------------|
| Steel roof deck | HEPA vac → Wet wipe → Rinse |
| Steel joists/beams | HEPA vac → Wet wipe → Rinse |
| Steel columns | HEPA vac → Wet wipe → Rinse |
| Concrete floor | Scrubber machine + alkaline |
| CMU walls | HEPA vac → Wet wipe OR power wash |
| Metal doors | Wet wipe → Rinse |
| Rigid ductwork | Per NADCA ACR |

### 5.3 Air Filtration Requirements

**Source:** NADCA ACR 2021 Edition, Section 3.6

**Minimum Requirement:** 4 air changes per hour (ACH)

**Calculation:**
```
Units Required = (Volume CF × 4 ACH) / (Unit CFM × 60)

Where:
  Volume CF = Area SF × Ceiling Height FT
  Unit CFM = Rated capacity of air scrubber
```

**Example:**
```
Work Area: 50,000 SF × 30 FT = 1,500,000 CF
Units = (1,500,000 × 4) / (2,000 CFM × 60) = 50 units
```

### 5.4 Reclean/Retest Protocol

When PRV samples exceed clearance thresholds:

**Step 1: Identify Deficient Areas**
- Map failed sample locations
- Determine surface types affected
- Assess pattern (localized vs widespread)

**Step 2: Reclean Specification**
```
Failed surfaces at [SAMPLE LOCATIONS] require additional cleaning:
- [SURFACE TYPE]: Execute [PROTOCOL] with additional pass
- Extend cleaning 10 feet beyond failed sample locations
- Document cleaning date, method, and personnel
```

**Step 3: Retest Protocol**
- Resample at original failed locations
- Add samples at adjacent locations if pattern suggests broader issue
- Same laboratory and analytical methods as original PRV

**Step 4: Documentation**
- Reference original sample numbers and results
- Document reclean activities
- Report retest results with comparison to original

**Iteration:** Repeat until all samples pass clearance thresholds.

---

