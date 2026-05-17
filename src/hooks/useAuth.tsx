import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AuthContextType {
  user: { uid: string, displayName: string, photoURL: string } | null;
  userData: { name: string; avatar: string; points: number } | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ uid: string, displayName: string, photoURL: string } | null>(null);
  const [userData, setUserData] = useState<{ name: string; avatar: string; points: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let uid = localStorage.getItem('ludo_device_id');
    if (!uid) {
      uid = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('ludo_device_id', uid);
    }

    const pseudoUser = {
      uid,
      displayName: `Player_${uid.slice(7, 11)}`,
      photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`
    };
    setUser(pseudoUser);

    const userRef = doc(db, 'users', uid);
    const unsubscribeDoc = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserData({ 
          name: data.name, 
          avatar: data.avatar, 
          points: data.points ?? 100 
        });
      } else {
        const initialData = {
          name: pseudoUser.displayName,
          avatar: pseudoUser.photoURL,
          points: 100,
          createdAt: new Date().toISOString()
        };
        setDoc(userRef, initialData).catch(err => {
          console.error("Failed to initialize user data:", err);
        });
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore user doc error:", err);
      setError("Please run the set_up_firebase tool or check database rules.");
      setLoading(false);
    });
    
    return () => unsubscribeDoc();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
