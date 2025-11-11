import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get the primary role ID from stored user roles
 * @returns The role ID (number) or null if not found
 */
export const getRoleId = async (): Promise<number | null> => {
  try {
    const rolesJson = await AsyncStorage.getItem('userRoles');
    if (!rolesJson) {
      return null;
    }

    const roles = JSON.parse(rolesJson);
    if (!Array.isArray(roles) || roles.length === 0) {
      return null;
    }

    // Get the first role (primary role)
    const primaryRole = roles[0];

    // Extract role ID from different possible formats
    if (typeof primaryRole === 'object') {
      return (
        primaryRole.id || primaryRole.roleId || primaryRole.role_id || null
      );
    } else if (typeof primaryRole === 'number') {
      return primaryRole;
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting role ID:', error);
    return null;
  }
};

/**
 * Add role ID to request body if available
 * @param body The request body object
 * @returns The body with roleId and role_id added if available
 */
export const addRoleIdToBody = async (body: any): Promise<any> => {
  try {
    const roleId = await getRoleId();
    if (roleId !== null && roleId !== undefined) {
      body.roleId = roleId;
      body.role_id = roleId; // alias for alternate DTOs
      console.log('✅ Added role ID to request body:', roleId);
    }
  } catch (error) {
    console.warn('⚠️ Failed to add role ID to body:', error);
  }
  return body;
};
