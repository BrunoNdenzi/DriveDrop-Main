import { StyleSheet, Platform } from 'react-native';
import { Colors, Typography } from '../../constants/DesignSystem';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomRightRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  contactsColumn: {
    width: '30%', // Reduced from 35% to give more space for messages
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  messagesColumn: {
    flex: 1,
    width: '70%', // Explicitly set width to take remaining space
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileContactsView: {
    flex: 1,
    padding: 20,
  },
  mobilePrompt: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  mobilePromptTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 16,
    color: Colors.text.primary,
  },
  mobilePromptText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: Colors.text.secondary,
  },
  mobileContactsButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mobileContactsButtonText: {
    color: "#FFFFFF",
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginTop: Platform.OS === 'ios' ? 50 : 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  recentContactsContainer: {
    marginTop: 32,
  },
  recentContactsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: Colors.text.primary,
  },
  viewAllButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  viewAllButtonText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  messagesContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: {
    marginRight: 16,
  },
  chatContactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminAvatar: {
    backgroundColor: Colors.error,
  },
  chatContactInitial: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: '600',
  },
  chatContactInfo: {
    flex: 1,
  },
  chatContactName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  chatContactStatus: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  messageListContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  noSelectedContactContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noSelectedContactText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 16,
  },
});

export default styles;
