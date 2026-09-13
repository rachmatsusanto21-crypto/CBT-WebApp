// Import the database instance we just configured
import { db } from "../firebase"; 
import { collection, addDoc } from "firebase/firestore";

// Example function using the imported 'db'
export async function saveEntry() {
  try {
    const docRef = await addDoc(collection(db, "logs"), {
      message: "App initialized successfully!",
      createdAt: new Date()
    });
    return docRef;
  } catch (error) {
    console.warn("Firestore log save notice:", error);
    return null;
  }
}
