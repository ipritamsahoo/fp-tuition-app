import sys
from google_auth_oauthlib.flow import InstalledAppFlow

# Drive API permissions scope
SCOPES = ['https://www.googleapis.com/auth/drive']

def main():
    client_id = input("Enter GOOGLE_CLIENT_ID: ").strip()
    client_secret = input("Enter GOOGLE_CLIENT_SECRET: ").strip()
    
    if not client_id or not client_secret:
        print("Error: Both Client ID and Client Secret are required.")
        sys.exit(1)
        
    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES
    )

    print("\nStarting local server for authentication...")
    print("Please log in via the browser window that opens.")
    creds = flow.run_local_server(port=0)
    
    print("\n" + "="*50)
    print("SUCCESSFULLY AUTHENTICATED!")
    print("="*50)
    print(f"GOOGLE_CLIENT_ID={client_id}")
    print(f"GOOGLE_CLIENT_SECRET={client_secret}")
    print(f"GOOGLE_REFRESH_TOKEN={creds.refresh_token}")
    print("="*50)
    print("Copy these values into your backend/.env file.")

if __name__ == "__main__":
    main()
