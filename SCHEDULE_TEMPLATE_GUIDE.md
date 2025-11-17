# Schedule Template Upload Guide

## Overview
The Schedule Management system now supports bulk schedule uploads via CSV/Excel templates. This allows managers to create multiple employee schedules at once by filling out a spreadsheet offline and uploading it.

## How to Use

### Step 1: Download the Template
1. Navigate to **System Admin > Schedule Management**
2. Click the **"📥 Download Template"** button
3. A CSV file named `schedule_template_YYYY-MM-DD.csv` will be downloaded

### Step 2: Fill Out the Template

The template includes the following columns:

| Column | Required | Format | Example | Description |
|--------|----------|--------|---------|-------------|
| **Employee Email*** | Yes | email@domain.com | john@company.com | Must match registered user email |
| **Date*** | Yes | YYYY-MM-DD | 2025-01-15 | Shift date |
| **Start Time*** | Yes | HH:MM | 09:00 | 24-hour format |
| **End Time*** | Yes | HH:MM | 17:00 | 24-hour format |
| **Break Duration** | No | Number (minutes) | 30 | Default: 30 minutes |
| **Notes** | No | Text | Morning shift | Optional notes |

*Fields marked with * are required

### Step 3: Template Examples

#### Example 1: Single Employee, Multiple Days
```csv
Employee Email*,Date (YYYY-MM-DD)*,Start Time (HH:MM)*,End Time (HH:MM)*,Break Duration (minutes),Notes
john@company.com,2025-01-15,09:00,17:00,30,Regular morning shift
john@company.com,2025-01-16,09:00,17:00,30,Regular morning shift
john@company.com,2025-01-17,14:00,22:00,30,Evening shift
```

#### Example 2: Multiple Employees, Same Day
```csv
Employee Email*,Date (YYYY-MM-DD)*,Start Time (HH:MM)*,End Time (HH:MM)*,Break Duration (minutes),Notes
john@company.com,2025-01-15,08:00,16:00,30,Front desk - morning
jane@company.com,2025-01-15,16:00,00:00,30,Front desk - evening
admin@company.com,2025-01-15,10:00,18:00,45,Management oversight
```

#### Example 3: Weekly Schedule
```csv
Employee Email*,Date (YYYY-MM-DD)*,Start Time (HH:MM)*,End Time (HH:MM)*,Break Duration (minutes),Notes
john@company.com,2025-01-15,09:00,17:00,30,Monday - Regular
john@company.com,2025-01-16,09:00,17:00,30,Tuesday - Regular
john@company.com,2025-01-17,09:00,17:00,30,Wednesday - Regular
john@company.com,2025-01-18,09:00,17:00,30,Thursday - Regular
john@company.com,2025-01-19,09:00,17:00,30,Friday - Regular
jane@company.com,2025-01-15,14:00,22:00,30,Monday - Evening
jane@company.com,2025-01-16,14:00,22:00,30,Tuesday - Evening
```

### Step 4: Upload the Template
1. Once you've filled out the template, **save the file**
2. Navigate back to **System Admin > Schedule Management**
3. Click the **"📤 Upload Template"** button
4. Select your filled CSV file
5. The system will:
   - Validate all data
   - Check that employee emails exist in the system
   - Verify date and time formats
   - Create or update schedules automatically

### Step 5: Review Results
After upload, you'll see:
- ✅ **Success message**: "X schedules uploaded successfully!"
- ⚠️ **Warnings**: If some rows had issues (displayed in console)
- 📊 **Updated schedule table**: Shows all schedules including newly uploaded ones

## Important Notes

### Data Validation Rules
- **Employee Email**: Must match an existing user in the system (case-sensitive)
- **Date Format**: Must be YYYY-MM-DD (e.g., 2025-01-15)
- **Time Format**: Must be HH:MM in 24-hour format (e.g., 09:00, 17:00, 23:30)
- **Break Duration**: Must be a number (minutes). Default is 30 if left empty
- **Duplicate Handling**: If a schedule already exists for an employee on a specific date, it will be **updated** with the new times

### Common Issues & Solutions

#### Issue: "User with email 'xxx@xxx.com' not found"
**Solution**: Ensure the email address exactly matches a registered user in the system. Check for typos, extra spaces, or incorrect domains.

#### Issue: "Invalid date format"
**Solution**: Use YYYY-MM-DD format. Examples:
- ✅ Correct: 2025-01-15
- ❌ Wrong: 01/15/2025, 15-01-2025, Jan 15 2025

#### Issue: "Invalid time format"
**Solution**: Use HH:MM in 24-hour format. Examples:
- ✅ Correct: 09:00, 17:00, 23:30
- ❌ Wrong: 9:00 AM, 5:00 PM, 17:0

#### Issue: "Missing required fields"
**Solution**: Ensure all required columns (marked with *) are filled in for each row

### Tips for Efficient Scheduling

1. **Weekly Templates**: Create a weekly template and duplicate it for recurring schedules
2. **Shift Patterns**: Use consistent time patterns for easier management
3. **Color Coding**: Use spreadsheet colors to identify different shift types before uploading
4. **Backup**: Keep a copy of your filled templates for reference
5. **Incremental Updates**: Upload schedules week by week rather than months at once

## Calculated Fields (Future Enhancement)

The template automatically calculates:
- **Total Hours Per Day**: End Time - Start Time - Break Duration
- **Total Hours Per Week**: Sum of all daily hours for each employee

These calculations are displayed in the schedule view after upload.

## Access Control

- **OPS Managers**: Full access to download template, upload schedules, edit, and delete
- **Assistant Managers**: Full access to download template, upload schedules, edit, and delete
- **Attendants**: View their own schedules only (no template access)

## Support

If you encounter issues with the template upload:
1. Check the browser console (F12) for detailed error messages
2. Verify all data follows the format guidelines above
3. Ensure all employee emails are registered in the system
4. Try uploading a smaller batch first to identify issues

---

**Last Updated**: 2025-01-17
**Version**: 1.0
