import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../context/AuthContext';

/**
 * Higher-Order Component (HOC) that restricts access to components based on user roles
 * 
 * @param WrappedComponent The component to wrap with role-based access control
 * @param allowedRoles Array of roles that have access to this component
 * @param redirectTo Optional screen to redirect to if access is denied (defaults to going back)
 */
function withRoleCheck<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  allowedRoles: ('client' | 'driver' | 'admin')[],
  redirectTo?: string
) {
  return function WithRoleCheck(props: P) {
    const { userProfile, loading } = useAuth();
    const navigation = useNavigation();

    useEffect(() => {
      // Only check after loading is complete and we have profile data
      if (!loading) {
        checkAccess(userProfile, allowedRoles);
      }
    }, [userProfile, loading]);

    const checkAccess = (profile: UserProfile | null, roles: string[]) => {
      // If no profile or role doesn't match, deny access
      if (!profile || !roles.includes(profile.role)) {
        Alert.alert(
          'Access Denied',
          'You do not have permission to access this screen',
          [
            {
              text: 'OK',
              onPress: () => {
                if (redirectTo) {
                  // @ts-ignore - navigation typing is complex with the HOC
                  navigation.navigate(redirectTo);
                } else {
                  navigation.goBack();
                }
              },
            },
          ],
          { cancelable: false }
        );
      }
    };

    // If still loading, can return a loading indicator
    if (loading) {
      return null; // Or a loading spinner
    }

    // If we get here, either access is allowed or the alert will trigger on mount
    return <WrappedComponent {...props} />;
  };
}

/**
 * Role-specific Higher Order Components
 */

/**
 * HOC specifically for admin-only screens
 */
const withAdminOnly = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  redirectTo?: string
) => withRoleCheck(WrappedComponent, ['admin'], redirectTo);

/**
 * HOC specifically for driver-only screens
 */
const withDriverOnly = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  redirectTo?: string
) => withRoleCheck(WrappedComponent, ['driver'], redirectTo);

/**
 * HOC specifically for client-only screens
 */
const withClientOnly = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  redirectTo?: string
) => withRoleCheck(WrappedComponent, ['client'], redirectTo);

/**
 * HOC for screens that are accessible by drivers and admins but not clients
 */
const withDriverOrAdminOnly = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  redirectTo?: string
) => withRoleCheck(WrappedComponent, ['driver', 'admin'], redirectTo);

// Export all HOCs
export {
  withRoleCheck,
  withAdminOnly,
  withDriverOnly,
  withClientOnly,
  withDriverOrAdminOnly,
};
