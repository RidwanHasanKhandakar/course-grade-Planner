# Gradepath

A browser-based course grade planner for customizing assessment weights and grade scales, projecting course marks, and estimating term GPA and cumulative GPA (CGPA).

## Run locally

```sh
npm ci
npm run dev
```

## Publish with GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. The included workflow builds and publishes the app on each push to `main`. The first deployment can also be started from the repository's **Actions** tab.
4. Open the published URL shown in the workflow. Project repositories are published at `https://<username>.github.io/<repository>/`; a repository named `<username>.github.io` is published at `https://<username>.github.io/`.

The site stores planner data in the current browser only; it does not upload marks to a server. Use **Export data** to save a JSON backup.
