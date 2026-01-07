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
import {WebSearchProviderItem} from '@/components/settings/WebSearchProviderItem';
import {XPProgressBar} from '@/components/gamification/XPProgress';
import {useUserManagement} from '@/hooks/stores/useUserStore';

export default function Settings() {
  const { currentUser } = useUserManagement();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 w-full">
        {/* Header */}
        <View className="px-6 pt-6 pb-4">
          <Text className="text-2xl font-semibold mb-1">Settings</Text>
          <Muted>Manage your account and preferences</Muted>
        </View>

        {/* Current User Progress Section */}
        {currentUser && (
          <View className="px-6 pb-6">
            <View className="p-4 bg-card rounded-lg border border-border">
              <Text className="text-lg font-semibold mb-3">Your Progress</Text>
              <XPProgressBar 
                xp={currentUser.xp || 0}
                showDetails={true}
                size="md"
              />
            </View>
          </View>
        )}
        
        {/* User Accounts Section */}
        <View className="px-6 pb-4">
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

        {/* Web Search Configuration Section */}
        <View className="px-6 pb-6">
          <List>
            <ListHeader>
              <Muted>Web Search Configuration</Muted>
            </ListHeader>
            <WebSearchProviderItem />
          </List>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
