## Part 6: Documentation Outputs

### 6.1 Deliverable 1: Cleaning Specification / Scope of Work

**Purpose:** Define scope, methods, labor, equipment, and acceptance criteria for contractor execution.

**Required Sections:**

| Section | Content |
|---------|---------|
| Project Identification | Facility, address, contact, dates |
| Scope Summary | Affected areas, zone classifications, total SF by disposition |
| Surface Inventory | Itemized surfaces by type, area, condition, disposition |
| Work Area Preparation | Containment, air filtration calculations (4 ACH minimum) |
| Surface-Specific Procedures | Cleaning methods by surface type |
| Removal Scope | Materials requiring removal with quantities |
| Labor Estimate | Hours by task, production rates applied |
| Equipment Requirements | Air scrubbers, lifts, supplies with quantities |
| Quality Assurance Criteria | Pass/fail thresholds for PRV |
| Worker Protection | PPE, safety protocols |

**Ceiling Deck Emphasis:** When ceiling decks are in scope, include:
- Note regarding enhanced sample density at PRV
- Recommendation for additional cleaning pass
- Access method requirements

### 6.2 Deliverable 2: Results Interpretation

**Purpose:** Establish applicable thresholds with regulatory justification and determine pass/fail status.

**Required Sections:**

| Section | Content |
|---------|---------|
| Purpose Statement | Why interpretation needed, specific questions addressed |
| Facility Classification | Operational / Non-Operational / Public-Childcare determination |
| Regulatory Framework | Applicable standards with citations |
| Regulatory Justification | Justification block per Section 3.3 |
| Recommended Thresholds | Specific values with source citations |
| Results Comparison | Actual data vs thresholds |
| Pass/Fail Determination | By sample, by area, overall |
| Reclean Requirements | If applicable, per Section 5.4 |
| Response to Inquiries | Address specific stakeholder questions if applicable |

**Standards Basis Statement (Required):**
> Metals thresholds are standards-based per BNL SOP IH75190. Particulate thresholds represent professional judgment with empirical validation (see FDAM Appendix B).

### 6.3 Deliverable 3: Executive Summary Report

**Purpose:** Document completion and compliance for closeout.

**Required Sections:**

| Section | Content |
|---------|---------|
| Project Summary | Identification, scope performed, conclusions |
| Clearance Confirmation | Statement that all areas passed clearance criteria |
| Discussion of Results | Testing summary, any reclean/retest activities |
| Threshold Reference | Thresholds applied with regulatory basis |
| Chronology | Timeline of assessment, cleaning, verification |
| Appendices | Lab reports, photos, field documentation |
| Standard of Care | Professional limitations |
| Standards Basis Statement | Per Section 6.2 |

---

## Part 7: Validation Requirements

### 7.1 Threshold Validation Status

| Category | Status | Source | Validation |
|----------|--------|--------|------------|
| Metals (Pb, Cd, As) | **Verified** | BNL SOP IH75190 | Standards-based |
| Particulates | **Validated** | IHC + empirical data | 93.3% pass rate (n=45) |
| ACH requirements | **Verified** | NADCA ACR 2021 | Standards-based |
| Sample density | Professional Judgment | Internal guidance | Ongoing refinement |

### 7.2 Validation Criteria

Thresholds are validated when:
- >90% first-pass clearance rate with proper cleaning
- <5% false negatives
- Correlation with absence of occupant complaints post-restoration

### 7.3 Ongoing Data Collection

For threshold refinement, collect:
- Condition assessment + lab result + clearance outcome (paired)
- Surface type performance data
- Reclean frequency by surface type
- Control/background sample baselines

---

## Part 8: System Architecture

### 8.1 SmokeScan Implementation

```
FIELD DEVICE
├── Project/building/zone/room hierarchy
├── Zone classification with distance documentation
├── Surface inventory (type, material, condition, area)
├── Photo capture with metadata
├── Sample location documentation
└── Offline capability with sync

CLOUD PLATFORM
├── Project data management
├── Lab result entry and threshold comparison
├── SOW calculations (quantities, labor, equipment)
├── Document generation
├── Pass/fail determination with threshold source flagging
└── Report export
```

### 8.2 Calculation Engine

**Surface Area Aggregation:**
```
Total by Type = Σ(Surface.area) WHERE Surface.type = [type]
Total by Disposition = Σ(Surface.area) WHERE Surface.disposition = [action]
```

**Equipment Sizing:**
```
Air Scrubbers = (Total Volume × 4 ACH) / (Unit CFM × 60)
```

**Pass/Fail Determination:**
```
FOR each Result:
  Threshold = Lookup(Analyte, Classification)
  ThresholdSource = Lookup(Analyte, Source)
  IF Result < Threshold THEN Pass ELSE Fail
  FLAG if ThresholdSource = "Professional Judgment"
```

---

## Part 9: Future Research

### 9.1 Field Screening Methods

**Optical Density Approach:**
Develop calibrated visual assessment correlating reflectance measurements to contamination levels.

**Research Questions:**
- Can OD measurements correlate with tape lift particle counts?
- What calibration protocol provides reliable results?

### 9.2 Control Sample Protocol

**Decision Required:** Determine whether control/background samples should be mandatory for relative comparison, or if absolute thresholds are sufficient.

**Options:**
- A: Mandatory control sample with relative pass/fail logic
- B: Control samples recommended but absolute thresholds authoritative
- C: Control samples required only for disputed results

### 9.3 Surface-Specific Threshold Refinement

With additional data collection, evaluate whether surface-specific thresholds are warranted (e.g., tighter thresholds for ceiling decks given higher failure rates).

---

## Appendix A: Lab Result Interpretation Framework

### A.1 Supported Laboratory Formats

FDAM supports two primary laboratory reporting formats:

**Format 1: Quantitative (particles/cm²)**
- Labs: Hayes Microbial, EMSL, others
- Direct comparison to FDAM thresholds
- Preferred format for pass/fail determination

**Format 2: Semi-Quantitative (% particles per field at 400x)**
- Labs: N.G. Carlson Analytical, EAA Baxter methodology
- Requires interpretation guidance
- Methodological differences from Format 1

### A.2 Format 1: Quantitative Interpretation

Direct threshold comparison:

| Analyte | Result | Threshold | Determination |
|---------|--------|-----------|---------------|
| Ash/Char | [value]/cm² | < 150/cm² | PASS if < 150 |
| Aciniform Soot | [value]/cm² | < 500/cm² | PASS if < 500 |

### A.3 Format 2: Semi-Quantitative Interpretation

**Source:** EAA Air-O-Cell Method Guide & Particle Atlas (2018); EMSL Fire & Smoke Damage Guide 2021

| % per Field (400x) | Lab Interpretation | FDAM Guidance |
|--------------------|-------------------|---------------|
| < 1% | Typical low | Presumed PASS - consistent with clearance |
| < 3% | Upper background | Presumed PASS - within acceptable range |
| 3-10% | Moderate impact | Professional judgment required |
| > 10% | Significant impact | Presumed FAIL - additional cleaning likely required |

**Methodological Caveat:**
Percentage-per-field and particles/cm² are fundamentally different analytical approaches. The guidance above represents professional correlation, not mathematical conversion. When results fall in the 3-10% range, consider:
- Visual condition at sample location
- Comparison to control samples
- Overall project context
- Retesting with quantitative methodology if determination is critical

### A.4 Decision Logic

```
INPUT: Lab Result + Format + Facility Classification

STEP 1: Identify Format
  IF particles/cm² → Use A.2 direct comparison
  IF % per field → Use A.3 interpretation guidance

STEP 2: Determine Threshold
  Metals → Per Facility Classification (Section 3.1)
  Particulates → Standard thresholds (Section 1.6)

STEP 3: Compare and Determine
  IF Result < Threshold → PASS
  IF Result > Threshold → FAIL
  IF Semi-quantitative in judgment range → Flag for professional review

STEP 4: Document
  Record result, threshold, source, determination
  Flag professional judgment thresholds
```

### A.5 Laboratory Selection Guidance

When selecting laboratories:
- Confirm reporting format before submission
- Request particles/cm² format when available
- Ensure consistent methodology across PRA and PRV sampling
- Request differentiation notes if atypical particles observed

### A.6 Unit Conversion Reference

Laboratories may report surface particle concentrations in different units. Use the following conversions:

**Area Conversions:**
```
1 cm² = 100 mm²
cts/mm² × 100 = cts/cm²
cts/cm² ÷ 100 = cts/mm²
```

**Common Laboratory Unit Formats:**

| Lab Format | Unit | Conversion to FDAM (cts/cm²) |
|------------|------|------------------------------|
| Hayes Microbial | cts/cm² | Direct comparison |
| EAA | cts/mm² | Multiply by 100 |
| N.G. Carlson | % per field | Use Appendix A.3 guidance |

**Example Conversion:**
- EAA reports: 5.0 cts/mm² fire residue
- FDAM equivalent: 5.0 × 100 = 500 cts/cm²
- Threshold comparison: 500 cts/cm² vs <150 (Ash/Char) = FAIL

**EAA Classification to FDAM Threshold Comparison:**

| EAA Classification | EAA (cts/mm²) | Converted (cts/cm²) | FDAM Status |
|--------------------|---------------|---------------------|-------------|
| Low | <1.0 | <100 | PASS |
| Typical-low | 1.0-5.0 | 100-500 | Evaluate vs threshold |
| Low-moderate | 5.0-10 | 500-1,000 | Likely FAIL |
| Moderate | 10-50 | 1,000-5,000 | FAIL |
| High | >50 | >5,000 | FAIL |

FDAM clearance thresholds (150 cts/cm² ash/char, 500 cts/cm² aciniform) fall within or at the upper boundary of EAA's "Typical-low" classification (100-500 cts/cm²), confirming FDAM thresholds are appropriately conservative for post-restoration clearance.

---

