import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useUserManagement } from '@/hooks/stores/useUserStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Muted } from '@/components/ui/typography';

export function UserManagement() {
  const { 
    users, 
    currentUser, 
    isLoading, 
    isCreatingUser,
    isDeletingUser,
    switchUser, 
    createUser, 
    deleteUser 
  } = useUserManagement();
  
  const [newUserName, setNewUserName] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const handleAddUser = async () => {
    if (newUserName.trim()) {
      try {
        await createUser(newUserName);
        setNewUserName("");
        setIsAddOpen(false);
      } catch (error) {
        console.error('Failed to create user:', error);
      }
    }
  };

  const handleDeleteUser = async () => {
    if (deleteUserId && users.length > 1) {
      try {
        await deleteUser(deleteUserId);
        setDeleteUserId(null);
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <View className="gap-4">
        <View className="pb-3">
          <Muted className="text-xs font-medium uppercase tracking-wide">Accounts</Muted>
        </View>
        <View className="p-6 bg-muted/30 rounded-lg border border-border">
          <Text className="text-center text-muted-foreground">Loading accounts...</Text>
        </View>
      </View>
    );
  }

  if (!currentUser && users.length === 0) {
    return (
      <View className="gap-4">
        <View className="pb-3">
          <Muted className="text-xs font-medium uppercase tracking-wide">Accounts</Muted>
        </View>
        <View className="p-6 bg-muted/30 rounded-lg border border-border">
          <Text className="text-center text-muted-foreground mb-4">No accounts found</Text>
          <Button 
            onPress={async () => await createUser("My Account")} 
            className="w-full"
            disabled={isCreatingUser}
          >
            <Text>{isCreatingUser ? "Creating..." : "Create First Account"}</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {/* Section Header with Add Button */}
      <View className="flex-row items-center justify-between pb-1">
        <Muted className="text-xs font-medium uppercase tracking-wide">Profiles</Muted>
        <Pressable 
          onPress={() => setIsAddOpen(true)}
          className="h-8 w-8 items-center justify-center rounded-md bg-primary active:opacity-80"
        >
          <Plus size={18} className="text-primary-foreground" />
        </Pressable>
      </View>
      
      {/* Users List */}
      <View className="rounded-lg border border-border bg-card overflow-hidden">
        {users.map((user, index) => {
          const isActive = currentUser?.id === user.id;
          const isLast = index === users.length - 1;
          
          return (
            <View key={user.id}>
              <Pressable 
                onPress={() => !isActive && switchUser(user.id)}
                className={cn(
                  "flex-row items-center justify-between p-4",
                  isActive ? "bg-primary/5" : "active:bg-muted/50"
                )}
              >
                {/* User Info */}
                <View className="flex-row items-center flex-1 gap-3">
                  <Avatar alt={user.name!} className="h-10 w-10 bg-primary/10">
                    {user.avatarUrl && <AvatarImage source={{ uri: user.avatarUrl }} />}
                    <AvatarFallback>
                      <Text className="text-sm font-medium text-primary">{user.name?.[0]?.toUpperCase()}</Text>
                    </AvatarFallback>
                  </Avatar>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className={cn(
                        "text-base",
                        isActive && "font-medium"
                      )}>
                        {user.name}
                      </Text>
                      {isActive && (
                        <View className="px-2 py-0.5 bg-primary/10 rounded">
                          <Text className="text-xs text-primary font-medium">Active</Text>
                        </View>
                      )}
                    </View>
                    <Muted className="text-sm">Level {user.level || 1} • {user.xp || 0} XP</Muted>
                  </View>
                </View>

                {/* Delete Button */}
                {users.length > 1 && (
                  <Pressable
                    onPress={() => setDeleteUserId(user.id)}
                    className="h-8 w-8 items-center justify-center rounded active:bg-muted"
                  >
                    <Trash2 size={18} className="text-muted-foreground" />
                  </Pressable>
                )}
              </Pressable>
              
              {/* Divider */}
              {!isLast && <View className="h-px bg-border mx-4" />}
            </View>
          );
        })}
      </View>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[90%] max-w-[90%] min-w-[80%]">
          <DialogHeader>
            <DialogTitle>Create Account</DialogTitle>
          </DialogHeader>
          <View className="gap-4 py-4">
            <View className="gap-2">
              <Label nativeID="name">Account Name</Label>
              <Input 
                placeholder="Enter a name" 
                value={newUserName} 
                onChangeText={setNewUserName}
                autoFocus
              />
            </View>
          </View>
          <DialogFooter className="flex-row gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onPress={() => {
                setIsAddOpen(false);
                setNewUserName("");
              }}
            >
              <Text>Cancel</Text>
            </Button>
            <Button 
              className="flex-1" 
              onPress={handleAddUser}
              disabled={!newUserName.trim() || isCreatingUser}
            >
              <Text>{isCreatingUser ? "Creating..." : "Create"}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteUserId !== null}
        onOpenChange={(open) => !open && setDeleteUserId(null)}
        title="Delete Account"
        description="Are you sure you want to delete this account? All progress and data will be permanently lost."
        onConfirm={handleDeleteUser}
      />
    </View>
  );
}

