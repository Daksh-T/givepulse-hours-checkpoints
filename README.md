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

The current checkpoint stays visible throughout its due date in the device's local timezone, labeled “due today.” It advances the following day. The card also shows the previous checkpoint's date, target, and zone based on the uploaded semester hours (not a historical snapshot). Before the first checkpoint, there is no previous checkpoint; after the last one, the final checkpoint remains visible.

It uses these targets:

- Fall 2026: September 25, October 30, November 20, and December 10
- Spring 2027: February 12, March 19, April 16, and April 28

Targets are 30, 60, 90, and 118 hours for senior Bonners/Canales, and 35, 70, 105, and 140 hours for everyone else.

Zones:

- Green: at or above target
- Yellow: at least 75% of target
- Red: below 75% of target

## How users get the CSV

The app includes an in-app help button with these instructions:

1. Go to `https://sewanee.givepulse.com/dashboard/impacts`
2. Click `Export Impacts`
3. If you do not see it, scroll down
4. Click **Export all** in the dropdown
5. If GivePulse says it will email your export, check your Sewanee email and click **Download** in that message
6. Upload the downloaded CSV to this app

The app accepts both GivePulse export layouts: the older `Date`, `Category`, `Value`, and `Organization` layout, and the newer layout with `Start Date`, `Start Time`, `End Date`, and `End Time` columns.

## Files

- `index.html`: app markup
- `styles.css`: app styling
- `app.js`: browser logic, semesters, and checkpoint rules

## Deploying

Publish this folder as a static site. No build step is needed.
