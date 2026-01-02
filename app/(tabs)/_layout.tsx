import {List} from '@/lib/icons/List';
import {Settings} from '@/lib/icons/Settings';
import {BookOpen as Book} from '@/lib/icons/Book';
import {Briefcase} from '@/lib/icons/Briefcase';
import {Tabs} from 'expo-router';

export const unstable_settings = {
  initialRouteName: "index",
};

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: () => <List className="text-foreground" />,
        }}
      />
      <Tabs.Screen
        name="roadmap"
        options={{
          title: 'Roadmaps',
          tabBarIcon: () => <Book className="text-foreground" />,
        }}
      />
      <Tabs.Screen
        name="career"
        options={{
          title: 'Career',
          tabBarIcon: () => <Briefcase className="text-foreground" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => <Settings className="text-foreground" />,
        }}
      />
    </Tabs>
  );
}
