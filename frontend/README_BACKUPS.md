# Backup Policy for DriveDrop Frontend

This directory contains backup (.bak) files for the DriveDrop frontend skeleton structure.

## Backup Policy

As per repository policy, backup files are created for new and modified source files to provide a safety net during development.

## Files with Backups

- `package.json.bak` - Frontend package configuration backup
- `src/types/index.ts.bak` - Shared TypeScript interfaces backup  
- `src/services/clientService.ts.bak` - Client service implementation backup

## Additional Files Created (without backups)

The following files were created as part of the frontend skeleton but don't have individual .bak files:

- `tsconfig.json` - TypeScript configuration
- `.eslintrc.js` - ESLint configuration  
- `src/services/driverService.ts` - Driver service stubs
- `src/services/adminService.ts` - Admin service stubs
- `src/hooks/useShipments.ts` - Custom React hooks
- `src/components/Button.tsx` - Basic UI component
- `src/navigation/index.tsx` - Navigation structure

## Purpose

These backup files serve as:
1. Safety net for recovery if files are accidentally modified
2. Reference for the original skeleton structure
3. Compliance with repository backup policies

## Usage

To restore a file from backup:
```bash
cp filename.bak filename
```

Note: Backup files should not be committed to the main branch in production environments.