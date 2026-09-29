# Research and sources

What we read to build SOC Claim Ledger, and which part of the tool each source shaped.
Every clause below was read in the issuing body's own text, or in a verbatim copy of it where the issuer's site did not respond, and checked on 29 September 2026.
Anything we could not check against the primary text is listed at the end and is not used in the product.

## At a glance

| Source | Issuer, date | Clause we rely on | What it shapes in SOC Claim Ledger |
|---|---|---|---|
| IT Act 2000, section 70A | Parliament, as amended in 2008 | Designates a national nodal agency for protecting Critical Information Infrastructure | Who the user is. NCIIPC holds this role |
| IT (Information Security Practices and Procedures for Protected System) Rules, 2018 | MeitY, notified 22 May 2018 | Rule 3(3)(j) requires a C-SOC. Rule 4(2) and 4(3)(b) require the CISO to share audit reports, SLAs, inventories and documented C-SOC records with NCIIPC | The data environment. The claim side and the evidence side both already travel from the CSE to NCIIPC |
| Guidelines for the Protection of National Critical Information Infrastructure, v2.0 | NCIIPC, 16 January 2015 | OC2 8.2.3(a) escalation matrix, 8.2.3(d) remove the original vulnerability, IC1 asset inventory, 6.3.6 ISD on 24x7x365 | Claim 1.1, the repeat-without-remediation detector, negative space, weekend coverage |
| Directions under section 70B(6), No. 20(3)/2022-CERT-In | CERT-In, 28 April 2022 | (i) NTP clock sync, (ii) report within 6 hours, (iv) enable logs of all ICT systems and keep them 180 days | Logging coverage claims and a proposed clock-consistency check |
| CEA (Cyber Security in Power Sector) Guidelines, 2021 | Central Electricity Authority, 7 October 2021 | Article 3(d) asset register, Article 5(b) ISD 24x7x365, Article 5(c)(3) IDS and IPS across IT and OT, Article 10(b) root cause analysis | P-04, a power entity, and its OT monitoring claim 2.1 |
| Cybersecurity and Cyber Resilience Framework (CSCRF), circular SEBI/HO/ITD-1/ITD_CSC_EXT/P/CIR/2024/113 | SEBI, 20 August 2024 | Regulated entities submit a periodic SOC efficacy report, scored by formula | Proof that regulators already collect quantified SOC self-reports, which is the claim side SOC Claim Ledger tests |
| MITRE ATT&CK, Enterprise v19.2 and ICS | MITRE | Tactic lists, including ICS TA0106 Impair Process Control | Columns of the negative-space grid and every rule's technique id |
| NIST SP 800-61 Rev. 3 | NIST, April 2025 | Incident response as part of CSF 2.0 risk management | Vocabulary for detection, response and recovery in the report |
| SOC-CMM | SOC-CMM, founded 2016, assessment workbook v2.4.2 | A published SOC maturity assessment | A reference for what a SOC self-assessment covers. Our claim sections were not modelled on it |

## Sources

### IT Act 2000, section 70A

Section 70A(1) lets the Central Government designate "any organisation of the Government as the national nodal agency in respect of Critical Information Infrastructure Protection".
Section 70A(2) makes that agency "responsible for all measures including Research and Development relating to protection of Critical Information Infrastructure".
NCIIPC was designated under it by gazette notification on 16 January 2014.

- Text: https://indiankanoon.org/doc/106027784/

### Protected System Rules, 2018

The Information Technology (Information Security Practices and Procedures for Protected System) Rules, 2018, notified by MeitY in the Gazette on 22 May 2018.
These rules are why a supervisory tool like SOC Claim Ledger has data to work on.

- Rule 3(1)(b)(iv) puts a representative of NCIIPC on every protected system's Information Security Steering Committee.
- Rule 3(3)(i) requires a documented process for IT Security Service Level Agreements.
- Rule 3(3)(j) requires the organisation to "establish a Cyber Security Operation Center (C-SOC)", used "for identifying unauthorized access ... and unusual and malicious activities ... by analyzing the logs on regular basis", with those records "documented".
- Rule 3(3)(l) requires regular backup of logs of networking, perimeter and communication devices, servers and systems.
- Rule 4(2) requires the CISO to share with NCIIPC, among other things, the inventory of hardware and software (f), "Information Security Audit Reports and post Audit Compliance Reports" (i) and "IT Security Service Level Agreements (SLAs)" (j).
- Rule 4(3)(b) requires the CISO to establish "a process of sharing documented records of Cyber Security Operation Center (related to unauthorised access, unusual and malicious activity)" with NCIIPC.

In SOC Claim Ledger terms, rule 4(2)(i) and (j) are the claim side, rule 4(2)(f) is the asset inventory, and rule 4(3)(b) is the alert and case evidence.

- Rule 3 text: https://indiankanoon.org/doc/74142394/
- Rule 4 text: https://indiankanoon.org/doc/110591796/

### NCIIPC Guidelines for the Protection of National Critical Information Infrastructure, v2.0

Released by NCIIPC on 16 January 2015.
nciipc.gov.in did not respond from our network, so we read the document through a public mirror of the NCIIPC PDF.

- Section 6.3.6 ends with "ISD must function on 24x7x365 basis", where ISD is the Information Security Division the CISO heads.
- Section 6.3 and Figure 5 place a Security Operation Centre under the CISO, "responsible for security event management and feedback".
- OC2, 8.2.3(a), says the incident response plan "must include a clearly demarcated escalation matrix".
- OC2, 8.2.3(d), says "the recovery mechanism must ensure that the original vulnerability is removed before making the system operational".
- IC1, 7.1, requires asset and inventory control, "meant to correlate and track all physical and virtual assets owned by the CIIs", with periodic review and audit.
- RA2, 10.2.4(d), says an audit "may include system information and log documentation".

These map to claim 1.1 (escalation), the repeat-without-remediation detector (8.2.3(d)), the weekend-coverage detector (24x7x365) and the inventory that sets expectations in negative space (IC1).

- Mirror: https://www.asianlaws.org/gcld/cyberlawdb/IN/guidelines/NCIIPC_Guidelines_V2.pdf

### CERT-In Directions of 28 April 2022

No. 20(3)/2022-CERT-In, "Directions under sub-section (6) of section 70B of the Information Technology Act, 2000 relating to information security practices, procedure, prevention, response and reporting of cyber incidents for Safe & Trusted Internet".

- (i) All covered entities "shall connect to the Network Time Protocol (NTP) Server of National Informatics Centre (NIC) or National Physical Laboratory (NPL) or with NTP servers traceable to these NTP servers, for synchronisation of all their ICT systems clocks".
- (ii) Cyber incidents listed in Annexure I must be reported to CERT-In "within 6 hours of noticing such incidents".
- (iv) Entities "shall mandatorily enable logs of all their ICT systems and maintain them securely for a rolling period of 180 days", within Indian jurisdiction.

- Text: https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf

### CEA (Cyber Security in Power Sector) Guidelines, 2021

Notified by the Central Electricity Authority on 7 October 2021.
They apply to power-sector Responsible Entities such as P-04, P-01 and P-06 in our demo.

- Article 3(d) says "all cyber assets of their identified/notified CIIs are recorded in the asset register".
- Article 5(b) says the Information Security Division "must be functional on 24x7x365 basis".
- Article 5(c)(3) requires "an Intrusion Detection System and Intrusion Prevention System capable of identifying behavioural anomaly in both IT as well as OT Systems".
- Article 5(c)(7) requires firewall logs "for the last 6 months duration", analysed, with critical and high findings closed.
- Article 10(b) requires "root cause analysis for all reportable events" and corrective action "so as to ensure that any re-occurrence of such event can be managed with ease".
- Article 10(e) requires the ISD to record "every details of cyber security events and incidents in both IT as well as the OT System" during an incident.
- Article 14(b) requires an IT and OT audit "at least once in every 6 (six) months" by a CERT-In empanelled auditor.

Article 5(c)(3) is the clause behind P-04's claim 2.1, "Critical OT assets under monitoring".
Article 10(b) is the clause behind the repeat-without-remediation detector for power entities.

- Notification: https://cea.nic.in/notification/cea-cyber-security-in-power-sector-guidelines-2021/?lang=en
- Text read from the published PDF: https://www.aegcl.co.in/wp-content/uploads/2022/06/24062022_Guidelines_on_Cyber_Security_in_Power_Sector_2021.pdf

### SEBI CSCRF, 20 August 2024

Circular SEBI/HO/ITD-1/ITD_CSC_EXT/P/CIR/2024/113 dated 20 August 2024.
SEBI's June 2025 FAQ on the framework says entities with their own or group SOC "will be required to submit the SOC efficacy report periodically as mandated in CSCRF" (FAQs 60 and 61).
FAQ 32 explains how scores in that efficacy report are computed to two decimal places from formula-based parameters.

A capital-markets regulator already asks entities to report their own SOC's efficacy as numbers.
That is exactly the kind of self-reported figure SOC Claim Ledger recomputes from records.

- FAQ: https://www.sebi.gov.in/sebi_data/faqfiles/jun-2025/1749647139924.pdf

### MITRE ATT&CK

The Enterprise matrix is at version 19.2.
In it, TA0005 is now named Stealth, and TA0112 Defense Impairment sits beside it, where earlier versions had one tactic, Defense Evasion.
The ICS matrix has twelve tactics, including TA0106 Impair Process Control, "The adversary is trying to manipulate, disable, or damage physical control processes", and TA0107 Inhibit Response Function.

The negative-space grid uses ATT&CK tactics as its columns and ICS techniques such as T0855 for OT rules.
The grid follows v19.2, with Stealth and Defense Impairment as separate columns, and says so under the grid.

- https://attack.mitre.org/tactics/enterprise/
- https://attack.mitre.org/tactics/ics/
- https://attack.mitre.org/tactics/TA0106/

### NIST SP 800-61 Rev. 3

"Incident Response Recommendations and Considerations for Cybersecurity Risk Management: A CSF 2.0 Community Profile", April 2025.
It supersedes Rev. 2 of August 2012, and treats incident response as part of CSF 2.0 risk management rather than a separate lifecycle.

- https://csrc.nist.gov/pubs/sp/800/61/r3/final

### SOC-CMM

SOC-CMM, founded in 2016 "to help security operations centers (SOC) measure and increase their maturity", publishes its full assessment as a workbook, currently v2.4.2.
It is a reference for how SOCs rate their own capability. The four sections of our claims file, timeliness, coverage, capability and staffing, came from our own design, not from SOC-CMM.

- https://www.soc-cmm.com/products/soc-cmm/

## Checks the build could ground in a real clause

Each of these uses only exports the submission contract in `packages/submission/src/schema.ts` already carries.

### Every inventoried system has logging enabled

Clause, CERT-In Direction (iv), "enable logs of all their ICT systems", with Protected System Rule 3(3)(j) and (l).
Recompute from `assets` and `log_sources`.
An asset counts as logged when `log_source_id` is set and that log source reported on at least 95% of `days_expected`.
Report the share of assets logged, split by `asset_class` and `criticality`, and list the assets with no log source.
Claim 2.2 already recomputes daily reporting per log source, so this adds the per-asset denominator and the citation.
The 180-day retention itself cannot be tested from a quarterly export and should show as insufficient evidence if claimed.

### Timestamps agree with one synchronised clock

Clause, CERT-In Direction (i), NTP synchronisation of all ICT system clocks.
Recompute from `alerts`, `cases` and `escalations`, counting records that break causal order.
- An alert acknowledged before it was created, `acknowledged_at < created_at`.
- A case closed before it opened, `closed_at < opened_at`.
- An escalation before its case opened, `escalated_at < opened_at` joined on `case_id`.
- A case opened before the earliest alert linked to it, `opened_at < min(alert.created_at)` over alerts with that `case_id`.
A clean submission has zero.
Any count above zero is a finding about record integrity, and every other time-based claim for that entity should carry a warning.
This is a new signal of the kind the statement asks for beyond its examples, and no claim in the questionnaire has to exist for it to run.

### Critical OT assets under monitoring, for power entities

Clause, CEA Guidelines 2021 Article 5(c)(3), IDS and IPS "in both IT as well as OT Systems", with Article 3(d) on the asset register.
This is claim 2.1, which already recomputes from `assets` where `asset_class` is `ot` and `criticality` is critical, joined to `alerts` and `log_sources`.
The change is to show the clause beside the claim for power-sector entities, so the P-04 row reads as a regulatory obligation and not only a KPI.

## Checked and left out

- ITIL priority and escalation vocabulary. The practice guides are behind a paywall, so we could not read the primary text. SOC Claim Ledger uses P1 to P4 and L1 to L3 as common SOC usage, without citing ITIL.
- RBI Cyber Security Framework in Banks, 2 June 2016. RBI replaced its technology circulars with the RBI (Commercial Banks - Cybersecurity, Technology: Risk, Resilience and Assurance Framework) Directions, 2026, issued 31 July 2026. We did not read the new Directions' SOC clauses in the primary text, so no BFSI claim cites RBI.
- NCIIPC's own website and its SOPs on auditing and incident response did not respond from our network. We cite only the Guidelines v2.0 text we could read.
