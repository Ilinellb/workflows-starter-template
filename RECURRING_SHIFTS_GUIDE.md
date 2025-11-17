# Recurring Shifts Guide

## Overview
The Schedule Management system now supports **recurring shifts**, allowing managers to create multiple schedules automatically based on recurrence patterns. This eliminates the need to manually create the same shift repeatedly.

## How to Create Recurring Shifts

### Step 1: Open Assign Schedule Modal
1. Navigate to **System Admin > Schedule Management**
2. Click **"➕ Assign Schedule"** button

### Step 2: Fill Basic Information
Fill in the standard schedule fields:
- **Employee**: Select the employee for this recurring shift
- **Date**: Start date for the recurring pattern
- **Shift Start**: Shift start time (e.g., 09:00)
- **Shift End**: Shift end time (e.g., 17:00)
- **Break Duration**: Break time in minutes (default: 30)
- **Notes**: Optional notes about the shift

### Step 3: Enable Recurring Shift
1. Check the box **"🔄 Make this a recurring shift"**
2. The recurring options section will appear (blue background)

### Step 4: Configure Recurrence Pattern
Choose one of three recurrence patterns:

#### Option 1: Daily (Every Day)
- **Use Case**: Employee works same shift every day
- **Example**: Mon-Sun, 9 AM - 5 PM for a month
- **Fields Required**:
  - End Date: When to stop creating shifts

#### Option 2: Weekly (Specific Days)
- **Use Case**: Employee works specific days each week
- **Example**: Monday, Wednesday, Friday every week
- **Fields Required**:
  - Days of Week: Check boxes for desired days (Sun-Sat)
  - End Date: When to stop creating shifts

#### Option 3: Monthly (Same Day Each Month)
- **Use Case**: Employee works same day number each month
- **Example**: 15th of every month
- **Fields Required**:
  - End Date: Last month to include

### Step 5: Set End Date
- Select the **End Date** for the recurring pattern
- Shifts will be created from Start Date to End Date
- Must be after the start date

### Step 6: Review Preview
The blue preview box shows:
- Number/type of shifts that will be created
- Date range
- Which days (for weekly recurrence)

### Step 7: Create Schedules
Click **"🔄 Create Recurring Schedules"** button
- System validates all fields
- Creates all schedules in bulk
- Shows success message with count

## Examples

### Example 1: Full-Time Employee (Daily Shift)
**Scenario**: John works 9 AM - 5 PM, Monday through Friday, for the entire month of February

**Configuration**:
- Employee: John
- Start Date: 2025-02-03 (Monday)
- Shift Start: 09:00
- Shift End: 17:00
- Break: 30 minutes
- Recurring: ✓ Enabled
- Pattern: Weekly
- Days: Mon, Tue, Wed, Thu, Fri (checked)
- End Date: 2025-02-28

**Result**: 20 shifts created (4 weeks × 5 days)

### Example 2: Part-Time Employee (Specific Days)
**Scenario**: Sarah works weekends only, 2 PM - 10 PM, for 8 weeks

**Configuration**:
- Employee: Sarah
- Start Date: 2025-01-04 (Saturday)
- Shift Start: 14:00
- Shift End: 22:00
- Break: 30 minutes
- Recurring: ✓ Enabled
- Pattern: Weekly
- Days: Sat, Sun (checked)
- End Date: 2025-02-28

**Result**: 16 shifts created (8 weeks × 2 days)

### Example 3: Monthly Meeting Schedule
**Scenario**: Manager oversight shift on the 1st of every month

**Configuration**:
- Employee: Manager
- Start Date: 2025-01-01
- Shift Start: 08:00
- Shift End: 12:00
- Break: 0 minutes
- Recurring: ✓ Enabled
- Pattern: Monthly
- End Date: 2025-12-01

**Result**: 12 shifts created (one per month)

### Example 4: Training Schedule (Daily for 2 Weeks)
**Scenario**: New employee orientation, every day for 2 weeks

**Configuration**:
- Employee: New Hire
- Start Date: 2025-02-03
- Shift Start: 09:00
- Shift End: 17:00
- Break: 60 minutes
- Notes: Orientation training
- Recurring: ✓ Enabled
- Pattern: Daily
- End Date: 2025-02-14

**Result**: 12 shifts created (14 days including weekends)

## Recurrence Pattern Details

### Daily Pattern
- Creates a shift **every single day** from start to end date
- Includes weekends
- Best for: 24/7 operations, on-call schedules, training periods

**Date Range**: Jan 1 - Jan 7
**Creates**: 7 shifts (one per day)

### Weekly Pattern
- Creates shifts only on **selected days of the week**
- Repeats weekly until end date
- Best for: Part-time schedules, specific work days, flexible arrangements

**Date Range**: Jan 1 - Jan 14 (2 weeks)
**Days Selected**: Mon, Wed, Fri
**Creates**: 6 shifts (3 days × 2 weeks)

### Monthly Pattern
- Creates a shift on the **same day number each month**
- If day doesn't exist in a month (e.g., Feb 31), uses last day of that month
- Best for: Monthly meetings, periodic reviews, monthly duties

**Start Date**: Jan 15
**End Date**: Jun 15
**Creates**: 6 shifts (15th of each month: Jan, Feb, Mar, Apr, May, Jun)

## Validation Rules

The system validates:
- ✅ **Employee selected**: Must choose an employee
- ✅ **Start date provided**: Cannot be empty
- ✅ **End date after start**: End date must be later than start date
- ✅ **Days selected for weekly**: At least one day must be checked
- ✅ **Time format**: Must use HH:MM format
- ✅ **Shift logic**: End time should be after start time

## Tips & Best Practices

### 1. Use Weekly Pattern for Regular Work Weeks
Instead of creating 5 daily shifts, use weekly pattern with Mon-Fri checked.

### 2. Plan Ahead
Create recurring schedules for entire quarters or months at once to save time.

### 3. Review Before Creating
Check the preview to ensure the correct number of shifts will be created.

### 4. Combine with One-Time Schedules
Use recurring for regular patterns, then add one-time schedules for exceptions.

### 5. Update Individual Schedules
After creating recurring schedules, you can still edit or delete individual shifts as needed.

### 6. Use Descriptive Notes
Add notes like "Morning crew" or "Weekend coverage" to help identify shift series.

## Modifying Existing Recurring Shifts

**Important**: Recurring shifts are created as individual schedules. There's no "linked series."

To modify:
- **Single shift**: Click Edit on that specific schedule
- **Multiple shifts**: Delete unwanted schedules and create a new recurring pattern
- **Change employee**: Delete old schedules, create new recurring pattern for new employee

## Common Use Cases

### Rotating Shifts
Create overlapping weekly patterns for different shifts:
- Early shift: Mon-Fri, 6 AM - 2 PM (Employee A)
- Late shift: Mon-Fri, 2 PM - 10 PM (Employee B)
- Night shift: Mon-Fri, 10 PM - 6 AM (Employee C)

### On-Call Rotation
Use weekly pattern with specific days:
- Week 1: Employee A on-call (Sat-Sun)
- Week 2: Employee B on-call (Sat-Sun)
- Repeat pattern

### Seasonal Staffing
Create recurring schedules for busy seasons:
- Summer: Daily shifts for all employees
- Off-season: Weekly pattern with fewer days

### Training Programs
Use daily pattern for intensive training periods:
- Week 1-2: Daily 9-5 training
- Week 3+: Switch to regular schedule pattern

## Troubleshooting

### Issue: "Please select at least one day for weekly recurrence"
**Solution**: When using Weekly pattern, check at least one day of the week box.

### Issue: "End date must be after start date"
**Solution**: Ensure the End Date is later than the Date (start date).

### Issue: Wrong number of shifts created
**Solution**: 
- For Daily: Check if you included/excluded weekends intentionally
- For Weekly: Verify the correct days are checked
- For Monthly: Ensure end date includes all desired months

### Issue: Need to cancel recurring shifts
**Solution**: Recurring shifts are individual schedules. Delete them one by one or use bulk delete (if available).

## Template Upload with Recurring Shifts

Currently, the CSV template upload creates individual schedules. To use recurring shifts:
1. Use the UI modal for recurring patterns
2. Or create a CSV with all individual dates pre-calculated
3. Future enhancement: Add recurring pattern column to CSV template

## Access Control

- **OPS Managers**: Can create recurring shifts for all employees
- **Assistant Managers**: Can create recurring shifts for all employees
- **Attendants**: Cannot create schedules (view only)

---

**Last Updated**: 2025-01-17
**Version**: 1.0
**Feature Status**: ✅ Fully Implemented
