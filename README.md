# GivePulse Hours Check

Static browser app for checking GivePulse hours from an exported impacts CSV.

## What it does

- Runs entirely in the browser
- Starts with the upload field emphasized and the other controls disabled until a CSV is uploaded
- Lets a user upload a GivePulse impacts CSV export
- Shows total hours immediately for the selected date range
- Offers semester presets for the current academic year
- Defaults to the current semester
- Anchors to the next available semester between semester date ranges
- Supports custom start and end dates
- Includes a detailed stats view with breakdowns by site and month
- Includes a calendar view with daily logged hours
- Shows Fall 2026 and Spring 2027 checkpoint status with a senior Bonner/Canale toggle
- Follows the device's light or dark appearance setting

## Semester behavior

Semester ranges are hardcoded from the academic calendar and are currently defined from Fall 2025 onward:

- Fall 2025
- Spring 2026
- Fall 2026
- Spring 2027
- Fall 2027
- Spring 2028

The semester dropdown only shows the current academic year:

- If the current date is in fall, it shows the current fall semester only
- If the current date is in spring, it shows the previous fall plus the current spring

## Checkpoint behavior

The checkpoint card only appears when the selected range is the actual current semester and checkpoint dates are configured for that semester.

It uses these targets:

- Fall 2026: September 25, October 30, November 20, and December 10
- Spring 2027: February 12, March 19, April 16, and April 28

Targets remain `23.4`, `58.5`, `87.75`, and `117` hours for senior Bonners/Canales, and `26.6`, `69`, `103.5`, and `133` hours for everyone else.

Zones:

- Green: at or above target
- Yellow: at least 75% of target
- Red: below 75% of target

## How users get the CSV

The app includes an in-app help button with these instructions:

1. Go to `https://sewanee.givepulse.com/dashboard/impacts`
2. Click `Export Impacts`
3. If you do not see it, scroll down
4. Click *Export all* in that popup
5. Upload the saved CSV to this app

## Files

- `index.html`: app markup
- `styles.css`: app styling
- `app.js`: browser logic, semesters, and checkpoint rules

## Deploying

Publish this folder as a static site. No build step is needed.
