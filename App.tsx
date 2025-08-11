import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from './android/app/src/screens/Home';

export type RootStackParamList = {
  Dashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="Dashboard" 
          component={Home} 
          options={{ title: 'Finance Tracker' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
