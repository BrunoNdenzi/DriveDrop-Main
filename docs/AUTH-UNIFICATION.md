# Authentication & Authorization Unification

This update unifies all authentication and authorization flows in the DriveDrop application to consistently use Supabase Auth. It removes custom JWT logic and ensures proper role checks are present for privileged screens.

## Changes Made

### Backend Authentication
1. **Replaced custom JWT with Supabase Auth tokens**:
   - Modified `auth.service.ts` to use Supabase tokens directly instead of generating custom JWTs
   - Updated the login, register, and refreshToken methods to work with Supabase Auth tokens
   - Removed dependencies on jsonwebtoken library for token creation/validation

2. **Unified authentication middleware**:
   - Updated `auth.middleware.ts` to validate Supabase tokens directly
   - Removed duplicated functionality from `supabase-auth.middleware.ts`
   - Enhanced user profile information attached to requests
   - Kept the resource-ownership validation functionality

3. **Role-based authorization**:
   - Maintained consistent role checks in backend API routes
   - Routes are protected with both authentication and role-specific authorization

### Mobile App Authentication

1. **Improved profile creation logic**:
   - Implemented a mutex pattern in `AuthContext.tsx` to prevent race conditions
   - Used a shared promise cache for profile creation operations
   - Improved error handling and retry logic

2. **Role-based access in screens**:
   - Created a higher-order component (HOC) in `useRoleCheck.tsx` for wrapping protected screens
   - Implemented role-specific HOCs (withAdminOnly, withDriverOnly, etc.)
   - Applied role checks to admin screens like AdminDashboardScreen

3. **Alternative hook-based role checking**:
   - Created custom hooks in `useRoleCheck.ts` that can be used inside functional components
   - Implemented role-specific hooks for common use cases (useAdminCheck, useDriverCheck, etc.)
   - Hooks provide access control with redirect options

4. **Enhanced navigation with better role handling**:
   - Updated the main navigation component to handle roles consistently
   - Improved fallback behavior for unknown roles
   - Ensured protected screens are only accessible to authorized users

## Usage Guidelines

### For Backend Routes

1. All routes requiring authentication should use the unified middleware:
   ```typescript
   router.get('/endpoint', authenticate, yourController);
   ```

2. Routes with role restrictions should use the authorize middleware:
   ```typescript
   router.post('/admin/endpoint', authenticate, authorize(['admin']), adminController);
   ```

3. For resource-level checks use the validateResourceOwnership middleware:
   ```typescript
   router.get('/shipments/:id', authenticate, validateResourceOwnership('id'), getShipment);
   ```

### For Mobile Screens

1. **Using HOC approach** (preferred for class components):
   ```typescript
   export default withAdminOnly(AdminScreen);
   // Or for multiple roles:
   export default withRoleCheck(DriverSettingsScreen, ['driver', 'admin']);
   ```

2. **Using hook approach** (preferred for functional components):
   ```typescript
   function AdminScreen() {
     useAdminCheck(); // Will redirect if not admin
     // Component code...
   }
   ```

3. **Using hook with permissions data**:
   ```typescript
   function DriverScreen() {
     const { hasAccess, loading } = useDriverCheck();
     
     if (loading) return <LoadingSpinner />;
     if (!hasAccess) return null; // Hook will handle redirect
     
     return <YourComponent />;
   }
   ```

## Testing Authentication

1. Verify login flow works correctly with Supabase Auth
2. Confirm token refresh works seamlessly
3. Test role-based access restrictions on both mobile and backend
4. Verify profile creation happens correctly without race conditions
5. Check that secure routes reject unauthorized users

---

By implementing these changes, we've ensured that:
1. All parts of DriveDrop use Supabase Auth consistently
2. No custom JWT logic exists anywhere in the codebase
3. Role checks are properly implemented before rendering privileged screens
4. Race conditions in profile creation have been eliminated
5. Authentication and authorization logic is more maintainable and secure
