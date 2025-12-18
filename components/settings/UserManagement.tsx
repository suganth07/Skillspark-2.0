import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
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
  const { users, currentUser, switchUser, addUser, removeUser, initialize } = useUserStore();
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  React.useEffect(() => {
    if (!currentUser) initialize();
  }, [currentUser]);

  const handleAddUser = async () => {
    if (newUserName.trim()) {
      await addUser(newUserName);
      setNewUserName("");
      setIsAddOpen(false);
    }
  };

  if (!currentUser) return null;

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between p-4 bg-card rounded-lg border border-border">
         <View className="flex-row items-center gap-3">
            <Avatar alt={currentUser.name || "User"}>
              <AvatarImage source={{ uri: currentUser.avatarUrl || undefined }} />
              <AvatarFallback>
                <Text>{currentUser.name?.[0]?.toUpperCase() || "U"}</Text>
              </AvatarFallback>
            </Avatar>
            <View>
              <Large>{currentUser.name}</Large>
              <Muted>Lvl {currentUser.level} • {currentUser.xp} XP</Muted>
            </View>
         </View>
         <Button variant="outline" size="sm" onPress={() => setIsManageOpen(true)}>
            <Text>Switch</Text>
         </Button>
      </View>

      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Profiles</DialogTitle>
          </DialogHeader>
          
          <View className="gap-2 py-4">
            {users.map((user) => (
              <View key={user.id} className={cn("flex-row items-center justify-between p-3 rounded-md", 
                currentUser.id === user.id ? "bg-secondary" : "hover:bg-muted"
              )}>
                 <Pressable 
                    className="flex-row items-center gap-3 flex-1" 
                    onPress={() => switchUser(user.id)}
                 >
                    <Avatar alt={user.name!} className="h-8 w-8">
                       <AvatarFallback>
                         <Text>{user.name?.[0]?.toUpperCase()}</Text>
                       </AvatarFallback>
                    </Avatar>
                    <Text className={cn("font-medium", currentUser.id === user.id && "text-primary")}>
                      {user.name}
                    </Text>
                    {currentUser.id === user.id && <Check size={16} className="text-primary" />}
                 </Pressable>

                 {currentUser.id !== user.id && (
                   <Button variant="ghost" size="icon" onPress={() => removeUser(user.id)}>
                      <Trash2 size={16} className="text-destructive" />
                   </Button>
                 )}
              </View>
            ))}
          </View>

          <DialogFooter>
             <Button variant="outline" className="flex-row gap-2 w-full" onPress={() => setIsAddOpen(true)}>
                <Plus size={16} className="text-foreground" />
                <Text>Create New Profile</Text>
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
