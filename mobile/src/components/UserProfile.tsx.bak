import React from 'react';
import { StyleSheet, Text, View, Image, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User, getFullName, getInitials, getRoleLabel } from '../types';
import { Colors } from '../constants/Colors';

interface UserProfileProps {
  user: User;
  showDetails?: boolean;
  style?: ViewStyle;
}

export function UserProfile({
  user,
  showDetails = true,
  style,
}: UserProfileProps) {
  return (
    <View style={[styles.container, style]}>
      {user.avatar ? (
        <Image source={{ uri: user.avatar }} style={styles.avatar} />
      ) : (
        <View style={styles.initialsContainer}>
          <Text style={styles.initials}>{getInitials(user)}</Text>
        </View>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.name}>{getFullName(user)}</Text>

        {showDetails && (
          <>
            <View style={styles.infoRow}>
              <Ionicons
                name="mail-outline"
                size={16}
                color={Colors.text.secondary}
                style={styles.icon}
              />
              <Text style={styles.infoText}>{user.email}</Text>
            </View>

            {user.phone && (
              <View style={styles.infoRow}>
                <Ionicons
                  name="call-outline"
                  size={16}
                  color={Colors.text.secondary}
                  style={styles.icon}
                />
                <Text style={styles.infoText}>{user.phone}</Text>
              </View>
            )}

            <View style={styles.roleContainer}>
              <Text style={styles.roleText}>{getRoleLabel(user.role)}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.border,
  },
  initialsContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.text.inverse,
    fontSize: 24,
    fontWeight: 'bold',
  },
  infoContainer: {
    marginLeft: 16,
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  icon: {
    marginRight: 6,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  roleContainer: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  roleText: {
    fontSize: 12,
    color: Colors.primaryDark,
    fontWeight: '500',
  },
});
