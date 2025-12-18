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
  
  initialize: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  addUser: (name: string) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  currentUser: null,
  isLoading: true,

  initialize: async () => {
    try {
      set({ isLoading: true });
      const usersList = await getAllUsers();
      
      // Sync with local storage ID
      const savedId = storage.getString("current_user_id");
      let activeUser: User | null = null;

      if (savedId) {
        activeUser = usersList.find(u => u.id === savedId) || null;
      }

      // If no valid saved user, but we have users, pick first
      if (!activeUser && usersList.length > 0) {
        activeUser = usersList[0];
        storage.set("current_user_id", activeUser.id);
      } else if (!activeUser && usersList.length === 0) {
        // First run! Create default user
        const newUser = await createUser("Student");
        activeUser = newUser;
        usersList.push(newUser);
        storage.set("current_user_id", newUser.id);
      }

      set({ users: usersList, currentUser: activeUser, isLoading: false });
    } catch (error) {
      console.error("Failed to init user store:", error);
      set({ isLoading: false });
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
