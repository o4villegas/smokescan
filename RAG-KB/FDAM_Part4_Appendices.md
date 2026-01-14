## Appendix B: Empirical Validation Data

### B.1 QVC Distribution Center Dataset

**Project:** QVC Outbound Fire Loss Restoration  
**Location:** Rocky Mount, NC  
**Date:** March 2023  
**Sample Type:** Post-Restoration Verification (PRV)  
**Sample Count:** 45 Bio-Tape samples (1.00 cm²)  
**Laboratory:** Hayes Microbial Consulting  
**Facility Classification:** Non-Operational Commercial

### B.2 Results Summary

**Aciniform-like Soot:**

| Statistic | Value |
|-----------|-------|
| Non-Detect | 21 samples (46.7%) |
| Range (detected) | 1 - 2,200/cm² |
| Median (detected) | 4.5/cm² |
| 90th Percentile | 65/cm² |
| Pass Rate | 91.1% (41/45) |

**Ash and Char:**

| Statistic | Value |
|-----------|-------|
| Non-Detect | 2 samples (4.4%) |
| Range (detected) | 1 - 440/cm² |
| Median (detected) | 5/cm² |
| 90th Percentile | 60/cm² |
| Pass Rate | 97.8% (44/45) |

**Combined Pass/Fail:**

| Status | Count | Percentage |
|--------|-------|------------|
| Both Pass | 42 | 93.3% |
| Any Fail | 3 | 6.7% |

### B.3 Surface Type Analysis

| Surface Type | Samples | Pass Rate |
|--------------|---------|-----------|
| Ceiling Deck (CD) | 17 | 82.4% |
| Ceiling Joist (CJ) | 20 | 95.0% |
| Beam | 6 | 100% |
| Column | 1 | 100% |
| Pipe | 1 | 100% |

**Finding:** Ceiling decks exhibit significantly lower pass rates, driving the ceiling deck emphasis protocol in Section 4.5.

### B.4 Failed Sample Analysis

| Sample | Location | Aciniform | Ash/Char | Failure |
|--------|----------|-----------|----------|---------|
| 02 | B2-C2 Grid - Ceiling Deck | 2,200/cm² | 4/cm² | Aciniform |
| 06 | D2-E2 Grid - Ceiling Deck | 1,320/cm² | 15/cm² | Aciniform |
| 12 | E3-F3 Grid - CJ Horizontal | 8/cm² | 440/cm² | Ash/Char |

All failures were addressed through reclean/retest protocol and subsequently passed.

### B.5 Laboratory Reference Ranges

**Source:** Hayes Microbial Consulting, based on ASTM D6602

| Particle Type | Normal Surface Range |
|---------------|---------------------|
| Ash/Char | 0-300/cm² |
| Aciniform Soot | 0-800/cm² |
| Cellulose Fibers | 0-1,600/cm² |
| Synthetic Fibers | 0-1,600/cm² |
| Silicates | 0-2,800/cm² |

These ranges represent typical environments, not post-fire clearance criteria. FDAM thresholds are set below these ranges to ensure demonstrably clean post-restoration conditions.

### B.6 Our Lady of Victory Dataset

**Project:** Our Lady of Victory (Catholic School)  
**Location:** Minnesota  
**Date:** February 2025  
**Sample Type:** Assessment  
**Sample Count:** 55 tease-tape samples  
**Laboratory:** N.G. Carlson Analytical  
**Facility Classification:** Public-Childcare

**Methodology:** Semi-quantitative (% particles per field at 400x)

**Distribution by Impact Level:**

| Impact Level | Samples | Percentage |
|--------------|---------|------------|
| No Char/No Soot | 14 | 27% |
| Typical Low (<1%) | 25 | 48% |
| Upper Background (<3%) | 7 | 13% |
| Moderate (3-10%) | 5 | 10% |
| Significant (>10%) | 1 | 2% |

**Pattern Observation:** Basement and lower-level areas showed higher contamination, consistent with smoke stratification.

---

## Appendix C: Deliverable Templates

### C.1 Cleaning Specification / SOW - Key Language Blocks

**Scope Statement:**
> [FACILITY] sustained fire damage on [DATE]. Industrial Hygiene Consulting, Corp. (IHC) conducted Pre-Restoration Assessment on [DATE]. Based on laboratory analysis and field assessment, the following cleaning specification establishes scope, methods, and acceptance criteria for fire residue restoration.

**Zone Summary Table:**
```
| Zone | Area (SF) | Condition | Disposition |
|------|-----------|-----------|-------------|
| [Zone ID] | [SF] | [Condition] | Clean/Remove |
```

**Air Filtration Calculation:**
> Work area volume: [SF] × [Height] = [CF]  
> Required ACH: 4 (NADCA ACR 2021)  
> Air scrubber capacity: [CFM] per unit  
> Units required: ([CF] × 4) / ([CFM] × 60) = [Units]

**Acceptance Criteria:**
> Post-restoration verification sampling will be conducted per FDAM methodology. Clearance thresholds:
> - Ash and Char: < 150 particles/cm²
> - Aciniform Soot: < 500 particles/cm²
> - Lead: [Threshold] µg/100cm² per [Classification] standards
>
> Surfaces exceeding thresholds require reclean and retest until passing.

### C.2 Results Interpretation - Key Language Blocks

**Purpose Statement:**
> IHC provides this results interpretation to establish applicable clearance thresholds for [FACILITY] based on facility classification and regulatory framework.

**Classification Determination:**
> [Insert applicable regulatory justification block from Section 3.3]

**Threshold Table:**
```
| Analyte | Threshold | Unit | Source |
|---------|-----------|------|--------|
| Lead | [value] | µg/100cm² | [BNL/EPA-HUD] |
| Ash/Char | 150 | particles/cm² | IHC/FDAM |
| Aciniform | 500 | particles/cm² | IHC/FDAM |
```

**Pass/Fail Summary:**
> Of [N] samples collected, [X] passed all clearance thresholds. [Y] samples exceeded thresholds and require reclean/retest per Section 5.4.

**Standards Basis Statement:**
> Metals thresholds are standards-based per BNL SOP IH75190 (Rev23, 06/23/17). Particulate thresholds represent professional judgment developed through IHC field experience with empirical validation (93.3% pass rate, n=45).

### C.3 Executive Summary - Key Language Blocks

**Clearance Statement:**
> Based on post-restoration verification testing conducted [DATE], all tested surfaces within [FACILITY] meet applicable clearance criteria. The fire residue restoration is complete and the facility is cleared for reoccupancy.

**Testing Summary:**
> [N] tape lift samples and [N] surface wipe samples were collected from [AREAS]. All results were below applicable thresholds.

**Threshold Reference:**
> Clearance thresholds applied:
> - Lead: [value] µg/100cm² (BNL SOP IH75190, Non-Operational)
> - Particulates: < 150/cm² ash/char, < 500/cm² aciniform (IHC/FDAM professional judgment with empirical validation)

---

## Appendix D: Reference Standards Compendium

### D.1 Primary Standards (Verified)

| Standard | Title | Version | Application |
|----------|-------|---------|-------------|
| BNL SOP IH75190 | Surface Wipe Sampling for Metals | Rev23, 06/23/17 | Metals clearance thresholds |
| EPA/HUD Lead Dust Hazard Standards | Lead Dust Hazard Standards | October 2024 | Public-Childcare lead thresholds |
| NADCA ACR | Assessment, Cleaning and Restoration of HVAC Systems | 2021 Edition | Air filtration requirements |
| IICRC/RIA/CIRI Technical Guide | Technical Guide for Wildfire Restoration | December 2025 | Zone framework |
| Army/Air Force National Guard | Guidelines for Indoor Firing Range Rehabilitation | Current | Non-Operational lead alternative |

### D.2 Referenced Standards

| Standard | Application |
|----------|-------------|
| OSHA 29 CFR 1910.1025 | Lead housekeeping requirements |
| OSHA 29 CFR 1910.1018 | Arsenic housekeeping requirements |
| OSHA 29 CFR 1910.1027 | Cadmium housekeeping requirements |
| OSHA Technical Manual Section II Ch. 2 | Surface contaminant methodology |
| NIOSH Method 9100 | Surface wipe sampling procedures |
| IICRC S700 | Standard for Fire and Smoke Damage Restoration |
| IICRC S520 | Standard for Mold Remediation |
| ASTM D6602 | Sampling and Testing of Carbon Black |

### D.3 Laboratory References

| Reference | Application |
|-----------|-------------|
| Environmental Analysis Associates (EAA) Air-O-Cell Method Guide & Particle Atlas (2018) | Combustion particle definitions; classification ranges; unit conversion reference; semi-quantitative interpretation |
| EMSL Fire & Smoke Damage Guide 2021 | Sampling procedures |
| Hayes Microbial Normal Ranges | Reference comparison (ASTM D6602 based) |

**Note on EAA:** Environmental Analysis Associates, founded by Daniel Baxter (inventor of the Air-O-Cell sampler), maintains 30+ years of indoor air quality data. Their classification system provides independent validation of FDAM threshold positioning. EAA reports in cts/mm² (convert to cts/cm² by multiplying by 100).

---

*FDAM v4.0.1 — End of Document*
