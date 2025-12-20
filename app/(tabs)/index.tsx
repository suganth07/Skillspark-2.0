import {View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {Stack} from "expo-router";
import * as React from "react";
import {Text} from "@/components/ui/text";

export default function Home() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 items-center justify-center p-6">
        <Stack.Screen
          options={{
            title: "Home",
          }}
        />
        <Text className="text-3xl font-bold mb-4">Welcome to SkillSpark! 🚀</Text>
        <Text className="text-lg text-muted-foreground text-center">
          This is your home page. Start building your amazing app here!
        </Text>
      </View>
    </SafeAreaView>
  );
}
