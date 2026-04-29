<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/db57f2a6-822e-41af-bb59-c3b5439df550

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app with the Netlify CLI so the `/api/extract-receipt` function and
   AI Gateway credentials are available:
   `netlify dev`

Gemini calls are made server-side from the `extract-receipt` Netlify Function
through Netlify AI Gateway, so no API key needs to be configured manually in
deployed environments.
