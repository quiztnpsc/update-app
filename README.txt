Revision Quiz app  (version 2026.11.09)

FIRST TIME (one-time)
1. Upload ALL files in this folder to your web host (replace the old files).
2. Open the app, close it, and open it again once.

HOW TO PUSH A FEATURE UPDATE (students do NOT reinstall)
1. Upload only the new app.js (and index.html if it is included) to the same place on your host.
2. Edit version.json: change "v" to a new number (e.g. 2026.12.01) and write a short "notes" message.
   data.js (the big quiz images file) does NOT need to be uploaded again unless the quizzes change.
3. Students see a banner "New version available" and tap "Update now" (or the "Check for updates" button).
   Their logins, answers and scores are kept. Only the small files are downloaded.

FORGOT-PASSWORD EMAIL OTP
Admin > "Email OTP" card: paste your EmailJS Service ID, Template ID and Public Key.
The EmailJS template must use {{to_email}}, {{to_name}} and {{otp}}.
Email sending works only in this installed/hosted app, not inside claude.ai.

Note: this installed copy stores users/scores on each device. For one shared class list across all devices, use the web link.
