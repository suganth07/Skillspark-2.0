import * as React from 'react';
import {View} from 'react-native';
import {Text} from "@/components/ui/text";
import {Muted} from "@/components/ui/typography";
import {ScrollView} from 'react-native-gesture-handler';
import List, {ListHeader} from "@/components/ui/list";
import {ThemeSettingItem} from '@/components/settings/ThemeItem';
import {UserManagement} from '@/components/settings/UserManagement';

export default function Settings() {
  return (
    <ScrollView className="flex-1 w-full px-6 bg-background pt-4 gap-y-6">
      <View className="mb-6">
        <Text className="text-2xl font-bold mb-2">Settings</Text>
        <Muted>Configure your app preferences</Muted>
      </View>
      
      {/* User Account Management - Create, Switch, Delete Users */}
      <UserManagement />
      
      <List>
        <ListHeader>
          <Muted>Appearance</Muted>
        </ListHeader>
        <ThemeSettingItem />
      </List>
    </ScrollView>
  );
}
