def validate_password(value: str) -> str:
        if len(value)< 8:
            raise ValueError("Password must be at least 8 characters.")
        elif not any(char.isupper() for char in value):
            raise ValueError('Password must contain atleast 1 uppercase letter.')
        elif not any(char.islower() for char in value):
            raise ValueError('Password must contain atleast 1 lowercase letter.')
        elif not any(char.isdigit() for char in value):
                raise ValueError('Password must contain atleast 1 digit.')
        elif not any (not char.isalnum() for char in value):
                raise ValueError('Password must contain atleast 1 special character.')
        elif any(char.isspace() for char in value):
                raise ValueError("Password cannot contain spaces.")
        return value