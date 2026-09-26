import os
from decimal import Decimal

from pwdlib import PasswordHash

from app.db.database import SessionLocal
from app.models.categories import Category
from app.models.products import Product
from app.models.users import User
from app.core.enums import InventoryType

password_hash = PasswordHash.recommended()


def seed():
    db = SessionLocal()

    try:
        # -------------------------
        # Admin User
        # -------------------------
        admin_username = os.getenv("ADMIN_USERNAME", "admin")
        admin_email = os.getenv("ADMIN_EMAIL")

        if not admin_email:
            raise ValueError("ADMIN_EMAIL environment variable is required")

        admin_password = os.getenv("ADMIN_PASSWORD")

        if not admin_password:
            raise ValueError("ADMIN_PASSWORD environment variable is required")

        existing_admin = (
            db.query(User)
            .filter(User.email == admin_email)
            .first()
        )

        if not existing_admin:
            admin = User(
                username=admin_username,
                email=admin_email,
                hashed_password=password_hash.hash(admin_password),
                is_admin=True,
            )

            db.add(admin)

        db.commit()

        # -------------------------
        # Main Categories
        # -------------------------
        main_categories = [
            "T-Shirts",
            "Shirts",
            "Pants",
            "Jeans",
            "Jackets",
        ]

        for name in main_categories:
            category = (
                db.query(Category)
                .filter(Category.name == name)
                .first()
            )

            if not category:
                db.add(Category(name=name))

        db.commit()

        # -------------------------
        # Subcategories
        # -------------------------
        subcategories = {
            "T-Shirts": [
                "Short Sleeve T-Shirts",
                "Long Sleeve T-Shirts",
            ],
            "Shirts": [
                "Casual Shirts",
                "Dress Shirts",
            ],
            "Pants": [
                "Chinos",
                "Cargo Pants",
            ],
            "Jeans": [
                "Slim Fit Jeans",
                "Regular Fit Jeans",
            ],
            "Jackets": [
                "Denim Jackets",
                "Leather Jackets",
            ],
        }

        for parent_name, children in subcategories.items():
            parent = (
                db.query(Category)
                .filter(Category.name == parent_name)
                .first()
            )

            if not parent:
                continue

            for child_name in children:
                child = (
                    db.query(Category)
                    .filter(Category.name == child_name)
                    .first()
                )

                if not child:
                    db.add(
                        Category(
                            name=child_name,
                            parent_id=parent.id,
                        )
                    )

        db.commit()

        # -------------------------
        # Products
        # -------------------------
        short_sleeve = (
            db.query(Category)
            .filter(Category.name == "Short Sleeve T-Shirts")
            .first()
        )

        if not short_sleeve:
            raise Exception("Short Sleeve T-Shirts category not found")

        products = [
            Product(
                name="Classic Black Cotton T-Shirt",
                description="A comfortable regular-fit cotton t-shirt suitable for everyday wear.",
                price=Decimal("1499.00"),
                stock_quantity=25,
                category_id=short_sleeve.id,
                color="Black",
                size="M",
                is_featured=False,
                inventory_type=InventoryType.Simple,
            ),
            Product(
                name="White Oversized T-Shirt",
                description="A relaxed oversized t-shirt made from soft and breathable cotton.",
                price=Decimal("1699.00"),
                stock_quantity=20,
                category_id=short_sleeve.id,
                color="White",
                size="M",
                is_featured=False,
                inventory_type=InventoryType.Simple,
            ),
            Product(
                name="Navy Blue Polo T-Shirt",
                description="A classic navy blue polo t-shirt with a clean and versatile design.",
                price=Decimal("1899.00"),
                stock_quantity=18,
                category_id=short_sleeve.id,
                color="Navy Blue",
                size="M",
                is_featured=True,
                inventory_type=InventoryType.Simple,
            ),
            Product(
                name="Grey Regular Fit T-Shirt",
                description="A simple grey regular-fit t-shirt made for comfortable everyday use.",
                price=Decimal("1399.00"),
                stock_quantity=30,
                category_id=short_sleeve.id,
                color="Grey",
                size="M",
                is_featured=False,
                inventory_type=InventoryType.Simple,
            ),
            Product(
                name="Olive Green Graphic T-Shirt",
                description="A casual olive green t-shirt featuring a modern graphic print.",
                price=Decimal("1599.00"),
                stock_quantity=22,
                category_id=short_sleeve.id,
                color="Olive Green",
                size="M",
                is_featured=False,
                inventory_type=InventoryType.Simple,
            ),
        ]

        for product in products:
            existing = (
                db.query(Product)
                .filter(Product.name == product.name)
                .first()
            )

            if not existing:
                db.add(product)

        db.commit()

        print("Seed completed successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed()