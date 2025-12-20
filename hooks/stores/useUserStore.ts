import { create } from 'zustand';
import { getAllUsers, getUserById, createUser, deleteUser } from '@/server/queries/users';
import { storage } from '@/lib/storage';
import type { UserSchema } from '@/db/schema';
import type { z } from 'zod';

type User = z.infer<typeof UserSchema>;

interface UserState {
  users: User[];
  currentUser: User | null;
  isLoading: boolean;
  initError: string | null;
  
  initialize: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  addUser: (name: string) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
}

// Initialize with stored user immediately if available
const getInitialUser = (): User | null => {
  try {
    const savedId = storage.getString("current_user_id");
    if (savedId) {
      // We'll validate this user exists during initialize()
      // Return null here and let initialize() handle the actual user loading
      return null;
    }
  } catch (error) {
    console.warn("Failed to get initial user from storage:", error);
  }
  return null;
};

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  currentUser: getInitialUser(),
  isLoading: true,
  initError: null,

  initialize: async () => {
    try {
      console.log("UserStore: Starting initialization...");
      set({ isLoading: true, initError: null });
      
      console.log("UserStore: Fetching users from database...");
      const usersList = await getAllUsers();
      console.log(`UserStore: Found ${usersList.length} users in database`);
      
      // Sync with local storage ID
      const savedId = storage.getString("current_user_id");
      console.log("UserStore: Saved user ID from storage:", savedId);
      let activeUser: User | null = null;

      if (savedId) {
        activeUser = usersList.find(u => u.id === savedId) || null;
        console.log("UserStore: Found saved user:", activeUser ? activeUser.name : "none");
      }

      // If no valid saved user, but we have users, pick first
      if (!activeUser && usersList.length > 0) {
        activeUser = usersList[0];
        storage.set("current_user_id", activeUser.id);
        console.log("UserStore: Using first available user:", activeUser.name);
      } else if (!activeUser && usersList.length === 0) {
        // First run! Create default user
        console.log("UserStore: No users found, creating default user...");
        const newUser = await createUser("My Account");
        activeUser = newUser;
        usersList.push(newUser);
        storage.set("current_user_id", newUser.id);
        console.log("UserStore: Created default user:", newUser.name);
      }

      console.log("UserStore: Initialization completed successfully");
      set({ users: usersList, currentUser: activeUser, isLoading: false, initError: null });
    } catch (error) {
      console.error("UserStore: Failed to initialize:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize user store';
      set({ 
        initError: errorMessage,
        isLoading: false,
        currentUser: null,
        users: []
      });
      // Re-throw so callers can handle the error
      throw error;
    }
  },

  switchUser: async (userId) => {
    const { users } = get();
    const user = users.find(u => u.id === userId);
    if (user) {
      storage.set("current_user_id", user.id);
      set({ currentUser: user });
    }
  },

  addUser: async (name) => {
    try {
      set({ isLoading: true });
      const newUser = await createUser(name);
      set(state => ({ 
        users: [...state.users, newUser],
        currentUser: newUser, // Auto switch to new user?? Maybe yes
        isLoading: false 
      }));
      storage.set("current_user_id", newUser.id);
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  removeUser: async (userId) => {
    try {
      await deleteUser(userId);
      set(state => {
        const remaining = state.users.filter(u => u.id !== userId);
        let nextUser = state.currentUser;
        
        // If we deleted specific user, or the current user
        if (state.currentUser?.id === userId) {
            nextUser = remaining[0] || null;
            if (nextUser) {
                storage.set("current_user_id", nextUser.id);
            } else {
                storage.delete("current_user_id");
            }
        }
        
        return { users: remaining, currentUser: nextUser };
      });
    } catch (e) {
      console.error(e);
    }
  }
}));
