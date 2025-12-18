import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useUserStore } from '@/hooks/stores/useUserStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, User as UserIcon, Check } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Muted, Large, Small } from '@/components/ui/typography';

export function UserManagement() {
  const { users, currentUser, switchUser, addUser, removeUser, initialize, isLoading } = useUserStore();
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  React.useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await initialize();
        console.log("UserManagement: Database initialized successfully");
      } catch (error) {
        console.error("UserManagement: Database initialization failed:", error);
      }
    };
    
    initializeDatabase();
  }, []);

  const handleAddUser = async () => {
    if (newUserName.trim()) {
      await addUser(newUserName);
      setNewUserName("");
      setIsAddOpen(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (users.length <= 1) {
      // Don't allow deleting the last user
      return;
    }
    await removeUser(userId);
  };

  if (isLoading) {
    return (
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-semibold">User Accounts</Text>
            <Muted className="text-sm">Loading user data...</Muted>
          </View>
        </View>
        <View className="p-6 bg-card rounded-lg border border-border">
          <Text className="text-center">Initializing database...</Text>
        </View>
      </View>
    );
  }

  if (!currentUser && users.length === 0) {
    return (
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-semibold">User Accounts</Text>
            <Muted className="text-sm">Setting up your first account</Muted>
          </View>
        </View>
        <View className="p-6 bg-card rounded-lg border border-border">
          <Text className="text-center mb-4">Creating your first account...</Text>
          <Button onPress={async () => await addUser("My Account")} className="w-full">
            <Text>Create Account</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      {/* Section Header */}
      <View>
        <Text className="text-lg font-semibold">User Accounts</Text>
        <Muted className="text-sm">Manage your profiles</Muted>
      </View>
      
      <View style={styles.userCard}>
         <View style={styles.userInfo}>
            <Avatar alt={currentUser?.name || "User"}>
              <AvatarImage source={{ uri: currentUser?.avatarUrl || undefined }} />
              <AvatarFallback>
                <Text>{currentUser?.name?.[0]?.toUpperCase() || "U"}</Text>
              </AvatarFallback>
            </Avatar>
            <View style={{ marginLeft: 12 }}>
              <Large>{currentUser?.name || "User"}</Large>
              <Muted>Lvl {currentUser?.level || 1} • {currentUser?.xp || 0} XP</Muted>
            </View>
         </View>
         <Button variant="outline" size="sm" onPress={() => setIsManageOpen(true)}>
            <Text>Manage</Text>
         </Button>
      </View>

      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Profiles</DialogTitle>
          </DialogHeader>
          
          <View style={{ gap: 8, paddingVertical: 16 }}>
            {users.map((user) => (
              <View key={user.id} style={[
                styles.userItem, 
                currentUser?.id === user.id ? styles.currentUser : styles.normalUser
              ]}>
                 <Pressable 
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
                    onPress={() => switchUser(user.id)}
                 >
                    <Avatar alt={user.name!}>
                       <AvatarFallback>
                         <Text>{user.name?.[0]?.toUpperCase()}</Text>
                       </AvatarFallback>
                    </Avatar>
                    <Text style={{ fontWeight: currentUser?.id === user.id ? 'bold' : 'normal' }}>
                      {user.name}
                    </Text>
                    {currentUser?.id === user.id && <Check size={16} />}
                 </Pressable>

                 {users.length > 1 && (
                   <Button variant="ghost" size="icon" onPress={() => handleDeleteUser(user.id)}>
                      <Trash2 size={16} />
                   </Button>
                 )}
              </View>
            ))}
          </View>

          <DialogFooter className="flex-row gap-2">
             <Button variant="outline" className="flex-1" onPress={() => setIsManageOpen(false)}>
                <Text>Close</Text>
             </Button>
             <Button className="flex-row gap-2 flex-1" onPress={() => { setIsManageOpen(false); setIsAddOpen(true); }}>
                <Plus size={16} className="text-primary-foreground" />
                <Text>Add User</Text>
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
         <DialogContent>
            <DialogHeader>
               <DialogTitle>Create Profile</DialogTitle>
            </DialogHeader>
            <View className="gap-4 py-4">
               <View className="gap-2">
                  <Label nativeID="name">Name</Label>
                  <Input 
                    placeholder="Enter name..." 
                    value={newUserName} 
                    onChangeText={setNewUserName} 
                  />
               </View>
            </View>
            <DialogFooter>
               <Button onPress={handleAddUser}>
                  <Text>Create</Text>
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1f1f1f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 6,
    marginVertical: 4,
  },
  currentUser: {
    backgroundColor: '#333',
  },
  normalUser: {
    backgroundColor: 'transparent',
  },
});
