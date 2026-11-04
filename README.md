# GitHub Projects — Lab 3: visualize and communicate

> **[Continue in your existing Lab 1 private copy / Mona exercise; do not copy, fork or clone this companion.](https://github.com/alvine-aurelio-org/bsp-github-projects-lab-1)**
>
> This is a public **reference guide**, not a learner template. **Mona lives in your own existing Lab 1 copy**, in the exercise issue you already started. The link opens the public starter reference; return to your private copy to work. Never post completion commands or run source-repository Actions here.

## Welcome

- **Who is this for?** Project managers, product owners, team leads and developers who completed Labs 1 and 2 and want to communicate delivery clearly.
- **What will you learn?** Roadmap dates, workload grouping, current Insights charts, native Project status updates and a local reporting snapshot.
- **What will you build?** Three saved views/chart outputs and an At risk delivery update on the same Project, plus a local-only TSV export.
- **How long?** **35 minutes**, across the four steps below: 10 + 8 + 7 + 10.
- **Prerequisites:** your existing private Lab 1 repository, its Mona exercise and the same private Project; Lab 2's implementation merged/closed in Sprint 1 and verification still open, unassigned, Effort 2, in Sprint 2. Retain all five Backlog issues and permission to edit Project fields, views, Insights and status updates. No personal access token, participant Node/npm, GitHub CLI, instructor account or paid add-on is required. If a required feature is unavailable under your account policy or entitlement, resolve access or leave the lab incomplete.

There are **three published repositories**, but each participant uses **one private repository and one private Project** for all three labs. Only Lab 1 is a starter. This companion has no Mona workflow, bootstrap or learner initialization. All four activities below use the **Project UI**, with **no repository edits or commits**.

Mona's comments identify your actual implementation and verification issues. Post each completion command as a **new comment in that same private Mona exercise issue**, not in a public source or a sample issue. **Every step here is SELF-CONFIRMED:** Mona does not read private Projects, inspect images or verify an export. Never confirm work you could not perform.

## Step 1 — Create a release roadmap

**Time: 10 minutes · Topic: date fields and roadmap planning**

**Why:** a Roadmap places existing tasks on a timeline to discuss timing and overlap. It is not automatic scheduling or a cross-Project portfolio roll-up.

**Do:**
- Open your Project's **Backlog**. Use the column-header **+ → New field** to create **Start date** and **Target date**, both type **Date**. Reuse existing correctly typed fields rather than duplicating them.
- Give implementation dates within **Sprint 1**, and verification dates within **Sprint 2**. Each start must be on or before its target.
- Select **New view → Roadmap**, name it **Release roadmap**, then use **Date fields** to map Start date and Target date. Under **Markers**, show Sprint iteration markers. Save the view and keep its filter from hiding completed implementation.

**Expected result:** two timeline bars: completed implementation in Sprint 1 and planned verification in Sprint 2, with meaningful dates and Sprint markers.

![New view and Roadmap Date fields navigation entry points](assets/screenshots/lab-3-step-1.png)

*Navigation reference: the overview locates date mapping, not your own task dates or every expanded setting. [Image sources and modifications](assets/screenshots/SOURCES.md).*

**Complete in your private Mona exercise:**

```text
/done 3-1
```

**SELF-CONFIRMED:** you confirm the saved roadmap, dates and markers. Mona does not inspect their configuration.

## Step 2 — Inspect workload

**Time: 8 minutes · Topic: ownership gaps and relative effort**

**Why:** grouping by Assignees reveals ownership and unassigned work; summing Effort compares relative size. Neither calculates available hours, leave, cost or actual capacity.

**Do:**
- Create a **Table** view named **Workload**. Clear inherited filters, then filter to **open** issues with `is:open`; completed implementation should not appear.
- In **View** settings beside the search bar, choose **Group by → Assignees**. Show **Effort** and **Sprint**, set **Field sum → Effort** (sometimes **Sum of**), and save.
- Find verification in the unassigned group with Effort **2**. Assign it to yourself and observe it move to your group. Keep its **Sprint 2** assignment; no instructor or other participant is needed.

**Expected result:** a saved open-work view grouped by assignee, with an owner for verification. The issue stays in the same Project and repository; do not hide unassigned rows to disguise missing ownership.

![Real Project table and New view entry point for workload grouping](assets/screenshots/lab-3-step-2.png)

*Navigation reference: this table overview does not show the expanded Group by menu; use the settings above. [Image sources and modifications](assets/screenshots/SOURCES.md).*

**Complete in your private Mona exercise:**

```text
/done 3-2
```

**SELF-CONFIRMED:** you confirm the grouping, open filter, effort sum and ownership change. Mona does not inspect Project workload or capacity.

## Step 3 — Read a progress chart

**Time: 7 minutes · Topic: current Insights and honest interpretation**

**Why:** a current chart shows today's distribution of Project items. One workshop session cannot establish historical velocity, burn-down or a multi-week trend.

**Do:**
- Open your Project's **Insights** graph icon near the top-right. Choose **New chart → Configure**.
- Name it **Delivery status**, choose **Column** layout, X-axis **Status**, Y-axis **Count of items**, clear unnecessary filters, and save. Use item count, not Effort.
- Inspect the actual categories. Ask: which Status contains the most items, and why is task count different from remaining effort? Confirm completed implementation contributes to Done; do not assume every merged PR is a separate planned task.

**Expected result:** a saved current chart named Delivery status, interpreted using your Project's real Status values. If Insights is unavailable, do not claim a chart exists; resolve access or record this lab as incomplete.

![Insights entry point and an example of a Project chart](assets/screenshots/lab-3-step-3.png)

*Navigation reference: the example chart is by iteration, not the required Status configuration. It illustrates the output only; use the axes specified above. [Image sources and modifications](assets/screenshots/SOURCES.md).*

**Complete in your private Mona exercise:**

```text
/done 3-3
```

**SELF-CONFIRMED:** you confirm creating and interpreting the chart. Mona calls no chart API and does not grade the image. An optional ordinary comment may explain your interpretation.

## Step 4 — Publish a delivery update

**Time: 10 minutes · Topic: native Project health and a local reporting snapshot**

**Why:** a native Project status update explains the risk behind the counts. Its target date describes project delivery, not each task's due date. A TSV is a point-in-time snapshot; the Project remains the source of truth.

**Do:**
- Open the Project's top-right **Project details** side panel. Under **Status updates**, select **Add update**. Choose **At risk**, set a target date after Sprint 2, write the following synthetic update, and select **Save update**. Use the native status-update feature, not an issue comment or a custom field:

  > **Risk:** checklist verification is unfinished.<br>
  > **Mitigation:** the verification task has an owner and is planned for Sprint 2.<br>
  > **Next action:** verify the published checklist before the target date.

- Return to **Backlog**, clear filters and show **Title, Status, Assignees, Priority, Effort and Sprint**. Open its **View** settings → **Export view data**. Save the downloaded **TSV locally** and open it in a spreadsheet or text editor.
- Confirm the export contains all **five issue rows** and the saved update is visible in the Project. Do not include Mona's exercise issue in the Project. **Do not commit, upload or attach the export or account screenshots** to any repository or issue. Keep verification open; do not close unfinished work to improve a chart.

**Expected result:** a saved native At risk update with mitigation and target date, and a local-only TSV matching the unfiltered saved view. The same one private repository and one private Project remain in use.

![Project details and View navigation for the status update and export](assets/screenshots/lab-3-step-4.png)

*Navigation reference: Add update and Export view data are described above; the overview is not an invented expanded dialog or evidence of your export. [Image sources and modifications](assets/screenshots/SOURCES.md).*

**Complete in your private Mona exercise:**

```text
/done 3-4
```

**SELF-CONFIRMED:** you confirm saving the native update and inspecting the local export. Mona does not read either. It posts a recap distinguishing verified repository work from self-confirmed Project work, then closes **only the exercise issue**. Verification remains open for Sprint 2.

## Troubleshooting

- **No Mona here:** expected. This companion is reference only; use the existing private Lab 1 exercise. `/status` and `/help` are safe there. Commands must be new comments from the learner who started it.
- **A roadmap bar is absent:** check both date cells, start-before-target ordering, the Date fields mapping, and view filters, especially a filter hiding closed implementation.
- **Workload looks empty or totals differ:** clear inherited filters, use `is:open`, confirm Effort is numeric, show unassigned work, and keep verification's Effort 2 and Sprint 2. Count and effort are different measures.
- **Insights or status updates are missing:** check Project access, account policy and entitlement. Do not substitute a spreadsheet or issue comment for the required native UI activity, claim API verification, or self-confirm unavailable work.
- **Export has fewer rows:** return to unfiltered Backlog, check all five planned issues are still members, and export again. Do not add a new repository or duplicate the Project to repair a view.
- **Mona rejects a command:** check the active step, exact `/done` command and existing private exercise. Do not edit bot progress or post commands to the public companions.

## Safety and evidence

Use synthetic training tasks only, never real BSP data or original BSP documents. All four UI activities are self-confirmed, not API-verified, AI-graded or independently assessed. Keep TSV exports and account screenshots local. No additional repository, Project, credential or service is needed, and no deployment, capacity model or portfolio dashboard is claimed.

## Author verification

Learners do not install tooling here. Authors need **Node 22+**, with no npm dependencies: `npm test` runs the built-in test runner and `npm run verify` runs [tools/verify-content.mjs](tools/verify-content.mjs). Both require the four actual PNGs and linked attribution files; missing assets fail rather than being replaced with placeholders. These are offline publication checks, not Mona completion commands or a live UI rehearsal.

## License and acknowledgements

Workshop text and code: [MIT](LICENSE). Reused GitHub Docs screenshot material is separately [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and [image sources](assets/screenshots/SOURCES.md). Inspired by [GitHub Skills](https://skills.github.com/), but independently authored, not an official GitHub Skills course and not endorsed by GitHub or BSP. [Security and privacy](SECURITY.md).
