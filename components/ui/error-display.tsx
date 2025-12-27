import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Clock, X } from 'lucide-react-native';

interface ErrorDisplayProps {
  error: string | Error | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryText?: string;
  title?: string;
  showIcon?: boolean;
  variant?: 'default' | 'card' | 'inline';
}

export function ErrorDisplay({ 
  error, 
  onRetry,
  onDismiss,
  retryText = 'Retry', 
  title,
  showIcon = true,
  variant = 'default'
}: ErrorDisplayProps) {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;
  
  // Detect specific error types
  const isModelOverloaded = errorMessage.toLowerCase().includes('overloaded') || 
                           errorMessage.toLowerCase().includes('quota') ||
                           errorMessage.toLowerCase().includes('rate limit') ||
                           errorMessage.toLowerCase().includes('too many requests');
  
  const isNetworkError = errorMessage.toLowerCase().includes('network') ||
                        errorMessage.toLowerCase().includes('connection') ||
                        errorMessage.toLowerCase().includes('fetch');

  const getErrorIcon = () => {
    if (isModelOverloaded) return <Clock className="h-5 w-5 text-orange-600" />;
    if (isNetworkError) return <RefreshCw className="h-4 w-4 text-blue-600" />;
    return <AlertTriangle className="h-5 w-5 text-red-600" />;
  };

  const getErrorTitle = () => {
    if (title) return title;
    if (isModelOverloaded) return 'Service Temporarily Unavailable';
    if (isNetworkError) return 'Connection Error';
    return 'Something went wrong';
  };

  const getErrorDescription = () => {
    if (isModelOverloaded) {
      return 'The AI service is currently experiencing high demand. Please try again in a few moments.';
    }
    if (isNetworkError) {
      return 'Please check your internet connection and try again.';
    }
    return errorMessage;
  };

  const getRetryText = () => {
    if (isModelOverloaded) return 'Try Again Later';
    if (isNetworkError) return 'Retry Connection';
    return retryText;
  };

  const errorContent = (
    <View className="space-y-3">
      <View className="flex-row items-center justify-between">
        {showIcon && (
          <View className="flex-row items-center justify-center flex-1">
            {getErrorIcon()}
          </View>
        )}
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} className="p-1">
            <X className="h-4 w-4 text-red-600" />
          </TouchableOpacity>
        )}
      </View>
      
      <View className="space-y-2">
        <Text className="font-medium text-center text-red-800">
          {getErrorTitle()}
        </Text>
        
        <Text className="text-sm text-center text-red-700 leading-5">
          {getErrorDescription()}
        </Text>
      </View>
      
      {onRetry && (
        <View className="flex-row justify-center">
          <Button 
            variant="outline" 
            onPress={onRetry}
            className={`border-red-200 ${isModelOverloaded ? 'border-orange-200' : ''}`}
          >
            <Text className={isModelOverloaded ? 'text-orange-700' : 'text-red-700'}>
              {getRetryText()}
            </Text>
          </Button>
        </View>
      )}
    </View>
  );

  if (variant === 'card') {
    return (
      <Card className={`${
        isModelOverloaded ? 'border-orange-200 bg-orange-50' : 
        isNetworkError ? 'border-blue-200 bg-blue-50' :
        'border-red-200 bg-red-50'
      }`}>
        <CardContent className="p-4">
          {errorContent}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'inline') {
    return (
      <View className={`p-3 rounded-lg ${
        isModelOverloaded ? 'bg-orange-50 border border-orange-200' : 
        isNetworkError ? 'bg-blue-50 border border-blue-200' :
        'bg-red-50 border border-red-200'
      }`}>
        {errorContent}
      </View>
    );
  }

  // Default variant - standalone view
  return (
    <View className="flex-1 justify-center items-center p-6">
      {errorContent}
    </View>
  );
}