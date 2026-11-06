# Gradepath

A browser-based course grade planner for customizing assessment weights and grade scales, projecting course marks, and estimating term GPA and cumulative GPA (CGPA).

## Run locally

```sh
npm ci
npm run dev
```

## Publish with GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, open **Settings > Pages** and set the build and deployment source to **GitHub Actions**.
3. Every push to `main` automatically builds and deploys the app. You do not need to start the workflow manually. Check the repository's **Actions** tab for deployment progress.
4. Open the published URL shown by the successful workflow. Project repositories are published at `https://<username>.github.io/<repository>/`; a repository named `<username>.github.io` is published at `https://<username>.github.io/`.

The site stores planner data in the current browser only; it does not upload marks to a server. Use **Export data** to save a JSON backup.

## GPA calculator

The **GPA calculator** menu lets you enter course names, credit hours, and letter grades without filling in assessment breakdowns. It calculates credit-weighted GPA live, then combines those course quality points with the previous CGPA and completed credits from **Academic settings** to estimate CGPA. The grade-to-points conversion uses the default 4.0 mapping (A = 4.0, A- = 3.7, B+ = 3.3, and so on), scaled to the selected GPA maximum. This mapping is an estimate; verify the point values against your university's official rules.

## Faculty assessment defaults

New courses use the supplied faculty distribution: Class Tests 5%, Mid Test 1 10%, Mid Test 2 10%, Lab Assessment 15%, Project 15%, Mid Term Examination 20%, and Final Term Examination 25%. The two mid tests split the provided 20% mid-test allocation evenly, making continuous assessment 55% and summative assessment 45%.

The default letter cutoffs are A (90), A- (85), B+ (80), B (75), B- (70), C+ (65), C (60), C- (55), D+ (50), D (45), and F (below 45). GPA points use a conventional editable 4.0-scale mapping because the supplied grade table did not specify GPA points. Assessment CLO/Bloom notes, marks, weights, targets, grade cutoffs, and GPA points can all be edited in the planner. For an existing course, use **Load faculty assessment defaults** to replace its current assessment rows and grade scale; the app asks for confirmation because this resets that course's marks and custom grade rules.
