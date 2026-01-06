import React from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronRight, CheckCircle, TrendingUp, Trash2, Clock, BookOpen } from 'lucide-react-native';
import { cn } from '@/lib/utils';

export interface CareerPathCardData {
  id: string;
  roleName: string;
  roleDescription: string | null;
  totalEstimatedHours: number;
  progress: number;
  topicsCount: number;
  completedTopics: number;
  categories: string[];
  createdAt: Date | null;
  status: 'active' | 'completed' | 'archived';
}

interface CareerPathCardProps {
  careerPath: CareerPathCardData;
  onPress: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  index?: number;
}

export function CareerPathCard({ careerPath, onPress, onDelete, isDeleting, index = 0 }: CareerPathCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          label: 'Completed',
          iconColor: 'text-green-600',
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          borderColor: 'border-green-200',
        };
      case 'active':
        return {
          icon: TrendingUp,
          label: 'Active',
          iconColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200',
        };
      case 'archived':
        return {
          icon: Clock,
          label: 'Archived',
          iconColor: 'text-gray-500',
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200',
        };
      default:
        return {
          icon: BookOpen,
          label: 'New',
          iconColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200',
        };
    }
  };

  const statusConfig = getStatusConfig(careerPath.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400).springify()}
    >
      <Card className="overflow-hidden">
        <Pressable
          onPress={onPress}
          className="active:opacity-70 web:hover:opacity-90"
          android_ripple={{ color: 'rgba(0, 0, 0, 0.05)' }}
        >
        <CardHeader className="pb-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-card-foreground leading-tight mb-1.5">
                {careerPath.roleName}
              </Text>
              {careerPath.roleDescription && (
                <Text className="text-sm text-muted-foreground leading-relaxed" numberOfLines={2}>
                  {careerPath.roleDescription}
                </Text>
              )}
            </View>
          </View>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Progress Section */}
          <View className="flex gap-1 space-y-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-medium text-muted-foreground">
                Progress
              </Text>
              <Text className="text-xs font-semibold text-foreground">
                {careerPath.completedTopics} of {careerPath.topicsCount} topics
              </Text>
            </View>
            
            {/* Progress Bar */}
            <View className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <View 
                className={cn(
                  'h-full rounded-full',
                  careerPath.progress === 100 ? 'bg-green-500' : 'bg-primary'
                )}
                style={{ width: `${careerPath.progress}%` }}
              />
            </View>
            
            <Text className="text-xs text-muted-foreground">
              <Text className="text-xs font-semibold text-foreground">{careerPath.progress}%</Text> complete
            </Text>
          </View>

          {/* Footer Actions */}
          <View className="flex-row items-center justify-between pt-2 border-t border-border">
            <View className="flex-row items-center gap-4">
              
            
              {/* Delete Button */}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={isDeleting}
                className="h-8 w-8 items-center justify-center rounded active:bg-muted"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#6b7280" />
                ) : (
                  <Trash2 size={16} color="#d23737ff" />
                )}
              </Pressable>
            </View>
            
            <View className="flex-row items-center gap-1">
              <Text className="text-sm font-medium text-primary">
                {careerPath.status === 'completed' ? 'Review' : 'Continue'}
              </Text>
              <ChevronRight className="h-4 w-4 text-primary" />
            </View>
          </View>
        </CardContent>
      </Pressable>
    </Card>
    </Animated.View>
  );
}
