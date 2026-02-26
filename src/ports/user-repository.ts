export interface User {
    id: string;
    name: string;
    email: string;
    password?: string;
    createdAt?: Date;
}

export interface UserRepository {
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    save(user: User): Promise<void>;
}
