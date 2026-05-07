<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3fcea8f3-f510-41e9-bab0-d322ca014835

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a Google Sheet for the backend.
3. Open Extensions > Apps Script, paste `apps-script/Code.gs`, and run `setupAcheroSpoolSheets` once.
4. Deploy the script as Web App:
   - Execute as: Me
   - Who has access: Anyone with the link
5. Copy `.env.example` to `.env.local` and set `VITE_APPS_SCRIPT_URL` to the Web App URL.
6. Run the app:
   `npm run dev`

## Google Sheets backend

The app no longer uses Firestore for projects and spools. Data is stored in two sheet tabs:

- `Projects`: project metadata.
- `Spools`: spool metadata plus `drawingDataJson` and `bomJson`.

The frontend uses the email entered on the login screen as `ownerId`. This is a functional Apps Script migration for an internal/lightweight workflow. For stricter production security, deploy the Web App with restricted Google Workspace access or add a proper OAuth-backed backend.
