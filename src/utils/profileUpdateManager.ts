// Simple event emitter for React Native (replaces Node.js events module)
class ProfileUpdateManager {
  private static instance: ProfileUpdateManager;
  private listeners: (() => void)[] = [];
  private isEmitting = false;

  static getInstance(): ProfileUpdateManager {
    if (!ProfileUpdateManager.instance) {
      ProfileUpdateManager.instance = new ProfileUpdateManager();
    }
    return ProfileUpdateManager.instance;
  }

  // Emit profile update event
  emitProfileUpdate() {
    if (this.isEmitting) {
      console.log(
        '📢 ProfileUpdateManager: Already emitting, skipping duplicate event',
      );
      return;
    }

    this.isEmitting = true;
    console.log(
      '📢 ProfileUpdateManager: Emitting profile update event to',
      this.listeners.length,
      'listeners',
    );

    this.listeners.forEach((callback, index) => {
      try {
        callback();
      } catch (error) {
        console.warn(
          `⚠️ ProfileUpdateManager: Error in callback ${index}:`,
          error,
        );
      }
    });

    this.isEmitting = false;
  }

  // Listen for profile update events
  onProfileUpdate(callback: () => void) {
    if (!this.listeners.includes(callback)) {
      this.listeners.push(callback);
      console.log(
        '📢 ProfileUpdateManager: Added listener, total listeners:',
        this.listeners.length,
      );
    }
  }

  // Remove profile update listener
  offProfileUpdate(callback: () => void) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
      console.log(
        '📢 ProfileUpdateManager: Removed listener, total listeners:',
        this.listeners.length,
      );
    }
  }

  // Get listener count for debugging
  getListenerCount(): number {
    return this.listeners.length;
  }
}

export const profileUpdateManager = ProfileUpdateManager.getInstance();
