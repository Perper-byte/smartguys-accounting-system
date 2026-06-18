// src/main/services/auth.service.test.ts
import { AuthService } from './auth.service';

// NOTE: For a real database test, you'd insert a dummy user into a test DB first.
// Here we are testing the password hashing integrity

describe('Authentication Service', () => {
    
    test('Password hashing should be consistent', () => {
        const password = "securePassword123!";
        const hash1 = AuthService.hashPassword(password);
        const hash2 = AuthService.hashPassword(password);

        // The hash should always be the same for the same password
        expect(hash1).toBe(hash2);
    });

    test('Should throw error on empty credentials', async () => {
        // Expect the login function to reject empty string
        await expect(AuthService.login("", "")).rejects.toThrow("Invalid Credentials");
    });

});