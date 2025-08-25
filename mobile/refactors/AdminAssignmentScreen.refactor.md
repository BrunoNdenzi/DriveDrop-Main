# Refactor plan: AdminAssignmentScreen.tsx

Path: F:\DD\DriveDrop-Main\mobile\src\screens\admin\AdminAssignmentScreen.tsx

Summary:
- Lines: 896
- Imports: 12
- Goal: Break this large screen into small, testable components and fix remaining lint/type issues.

Suggested extraction (concrete steps):
1. Extract Header component
   - Purpose: screen title, back button, filters.
   - New file: mobile/src/components/AdminAssignmentHeader.tsx
   - Props: title: string; onFilterChange?: (v)=>void; selectedFilter?: string

2. Extract AssignmentList component
   - Purpose: main FlatList / SectionList rendering rows.
   - New file: mobile/src/components/AdminAssignmentList.tsx
   - Props: data: Assignment[]; onSelect: (id)=>void
   - Implement virtualization optimizations and keyExtractor.

3. Extract AssignmentItem component
   - Purpose: row presentation, status badge, action buttons.
   - New file: mobile/src/components/AdminAssignmentItem.tsx
   - Props: item: Assignment; onAction: (action, id)=>void

4. Extract Modal(s) or Drawer for assignment detail & actions
   - Purpose: small focused UI for editing/assigning.
   - New files: mobile/src/components/AssignmentDetailModal.tsx

Type fixes:
- Replace all ny uses with specific types (Assignment, User, Location) — add types in mobile/src/types/index.ts
- Use React.FC<Props> or typed function components.
- Ensure style objects match ViewStyle, TextStyle, ImageStyle where applicable.

Lint fixes (remaining):
- Remove unused vars / imports.
- Replace inline styles with StyleSheet.create.
- Replace color literals with theme tokens (import from mobile/src/theme or create colors.ts).

Testing & verification:
- After each extraction, run yarn type-check and yarn lint for the file.
- Run the app in Expo and validate the UI for the screen.

Commit strategy:
- One-file-per-commit:
  - branch naming: feat/T003-admin-<component>-extract
  - commit message: [T003] feat: extract <ComponentName> from AdminAssignmentScreen.tsx

Acceptance criteria for this task:
- AdminAssignmentScreen.tsx reduced by at least 30% lines OR split into at least two new components.
- yarn type-check reports no new errors caused by refactor.
- ESLint remaining errors for this screen are <= 5 (ideally 0) after fixes.
