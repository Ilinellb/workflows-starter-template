# Implementation Plan

## Changes to Implement:

### 1. Remove start_time field from employee management
- Remove from formData state initialization
- Remove from Add Employee modal UI
- Remove from Edit Employee modal UI
- Remove from resetForm function
- Remove from openEditModal function
- Keep start_time in backend (don't modify API) for backwards compatibility

### 2. Ensure Delete functionality is accessible
- Delete button already exists in AttendantManagementTab
- Just need to verify it works for OPS Manager

### 3. Create Schedule Management for OPS Manager
- Add a new section in MyScheduleTab or System Admin
- Allow OPS Manager to:
  - View all employee schedules
  - Assign shifts to employees
  - Edit existing shifts
  - Delete/unassign shifts
- Use existing POST /api/schedules/assign endpoint
- Use existing GET /api/schedules/team endpoint

## Implementation Order:
1. Remove start_time from employee forms (quick fix)
2. Add Schedule Management UI for OPS Manager
3. Test all functionality
