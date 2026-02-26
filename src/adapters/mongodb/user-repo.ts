import { Db, Collection } from "mongodb";
import { User, UserRepository } from "../../ports/user-repository";

export class MongoUserRepository implements UserRepository {
    private collection: Collection<User>;

    constructor(db: Db) {
        this.collection = db.collection<User>("users");
    }

    async findById(id: string): Promise<User | null> {
        return await this.collection.findOne({ id });
    }

    async findByEmail(email: string): Promise<User | null> {
        return await this.collection.findOne({ email });
    }

    async save(user: User): Promise<void> {
        await this.collection.updateOne(
            { id: user.id },
            { $set: user },
            { upsert: true }
        );
    }
}
