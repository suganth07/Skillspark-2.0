import * as React from 'react';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Text} from "@/components/ui/text";
import {Muted} from "@/components/ui/typography";
import {ScrollView} from 'react-native-gesture-handler';
import List, {ListHeader} from "@/components/ui/list";
import {ThemeSettingItem} from '@/components/settings/ThemeItem';
import {UserManagement} from '@/components/settings/UserManagement';
import {EmotionDetectionItem} from '@/components/settings/EmotionDetectionItem';
import {GeneratedVideosItem} from '@/components/settings/GeneratedVideosItem';
import {AIProviderItem} from '@/components/settings/AIProviderItem';

export default function Settings() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 w-full">
        {/* Header */}
        <View className="px-6 pt-6 pb-4">
          <Text className="text-2xl font-semibold mb-1">Settings</Text>
          <Muted>Manage your account and preferences</Muted>
        </View>
        
        {/* User Accounts Section */}
        <View className="px-6 pb-6">
          <UserManagement />
        </View>
        
        {/* Appearance Section */}
        <View className="px-6 pb-6">
          <List>
            <ListHeader>
              <Muted>Appearance</Muted>
            </ListHeader>
            <ThemeSettingItem />
          </List>
        </View>

        {/* Learning Features Section */}
        <View className="px-6 pb-6">
          <List>
            <ListHeader>
              <Muted>Learning Features</Muted>
            </ListHeader>
            <EmotionDetectionItem />
            <GeneratedVideosItem />
          </List>
        </View>

        {/* AI Configuration Section */}
        <View className="px-6 pb-6">
          <List>
            <ListHeader>
              <Muted>AI Configuration</Muted>
            </ListHeader>
            <AIProviderItem />
          </List>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
