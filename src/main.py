#!/usr/bin/env python3

import os
import json
import requests
import urllib.parse
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, redirect, session, url_for
from flask_cors import CORS

# Import Google Sheets functionality
import re
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from googleapiclient.discovery import build

app = Flask(__name__)
CORS(app)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-here-change-in-production')

# Google Sheets configuration
SPREADSHEET_ID = '1wB2LvwJpbQGKJhHKgTPrYiDRzKN7wdtXHiEDgv_TV5U'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SERVICE_ACCOUNT_FILE = 'bstory-profit-and-loss-6f330c3c5c5d.json'

# Zoho Books OAuth 2.0 Configuration
ZOHO_CLIENT_ID = '1000.V2399M2JW6SOTOBHVHGJJLCTCKYEMA'
ZOHO_CLIENT_SECRET = '8ced2eb708aaf60d75dcf6b6aaaba333872a0ce6a8'
# Use Vercel hosted callback page
ZOHO_REDIRECT_URI = 'https://bstory-zoho-auth-dhaoacxz6-michael-macdonalds-projects-91c3e4ca.vercel.app'
ZOHO_BASE_URL = 'https://www.zohoapis.com/books/v3'
ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'
# Frontend URL for redirecting back after auth
FRONTEND_URL = 'https://oqypkszc.manus.space'

# OAuth URLs
AUTHORIZATION_URL = f"{ZOHO_ACCOUNTS_URL}/oauth/v2/auth"
TOKEN_URL = f"{ZOHO_ACCOUNTS_URL}/oauth/v2/token"

# In-memory token storage (in production, use a database)
zoho_tokens = {}

# Google Sheets Functions (unchanged)
def get_sheets_service():
    """Create and return a Google Sheets API service object."""
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build('sheets', 'v4', credentials=credentials)
    return service

def parse_thai_baht_value(value_str):
    """Parse Thai Baht value string to float."""
    if not value_str:
        return 0.0
    
    # Remove Thai Baht symbol and clean up the string
    cleaned = str(value_str).replace('฿', '').replace(',', '').replace(' ', '')
    
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def get_sheet_tabs():
    """Get all sheet tabs from the spreadsheet."""
    try:
        service = get_sheets_service()
        sheet = service.spreadsheets()
        
        # Get spreadsheet metadata to list all sheets
        spreadsheet = sheet.get(spreadsheetId=SPREADSHEET_ID).execute()
        sheets = spreadsheet.get('sheets', [])
        
        tab_names = []
        for sheet_info in sheets:
            tab_name = sheet_info.get('properties', {}).get('title', '')
            # Skip the Template tab
            if tab_name != 'Template':
                tab_names.append(tab_name)
            
        return tab_names
    except Exception as e:
        print(f"Error getting sheet tabs: {e}")
        return []

def get_payroll_data_from_tab(tab_name):
    """Get payroll data from a specific tab."""
    try:
        service = get_sheets_service()
        sheet = service.spreadsheets()
        
        # Read H7 (Total Payroll) and C8 (Active Staff)
        ranges = [
            f"'{tab_name}'!H7",  # Total Payroll
            f"'{tab_name}'!C8"   # Active Staff
        ]
        
        result = sheet.values().batchGet(
            spreadsheetId=SPREADSHEET_ID,
            ranges=ranges
        ).execute()
        
        value_ranges = result.get('valueRanges', [])
        
        total_payroll = 0.0
        active_staff = 0
        
        # Parse Total Payroll from H7
        if len(value_ranges) >= 1 and value_ranges[0].get('values'):
            payroll_value = value_ranges[0]['values'][0][0] if value_ranges[0]['values'][0] else '0'
            total_payroll = parse_thai_baht_value(payroll_value)
                
        # Parse Active Staff from C8
        if len(value_ranges) >= 2 and value_ranges[1].get('values'):
            staff_value = value_ranges[1]['values'][0][0] if value_ranges[1]['values'][0] else '0'
            try:
                active_staff = int(float(str(staff_value)))
            except ValueError:
                active_staff = 0
        
        return {
            'tab_name': tab_name,
            'total_payroll': total_payroll,
            'active_staff': active_staff
        }
        
    except Exception as e:
        print(f"Error getting payroll data from tab '{tab_name}': {e}")
        return {
            'tab_name': tab_name,
            'total_payroll': 0.0,
            'active_staff': 0,
            'error': str(e)
        }

# Zoho Books Functions (improved)
def get_authorization_url():
    """Generate OAuth authorization URL"""
    params = {
        'response_type': 'code',
        'client_id': ZOHO_CLIENT_ID,
        'scope': 'ZohoBooks.fullaccess.all',
        'redirect_uri': ZOHO_REDIRECT_URI,
        'access_type': 'offline',
        'prompt': 'consent'
    }
    
    auth_url = f"{AUTHORIZATION_URL}?{urllib.parse.urlencode(params)}"
    return auth_url

def exchange_code_for_token(auth_code):
    """Exchange authorization code for access token"""
    data = {
        'grant_type': 'authorization_code',
        'client_id': ZOHO_CLIENT_ID,
        'client_secret': ZOHO_CLIENT_SECRET,
        'redirect_uri': ZOHO_REDIRECT_URI,
        'code': auth_code
    }
    
    print(f"Token exchange request data: {data}")
    print(f"Token exchange URL: {TOKEN_URL}")
    
    response = requests.post(TOKEN_URL, data=data)
    result = response.json()
    
    print(f"Token exchange response status: {response.status_code}")
    print(f"Token exchange response: {result}")
    
    return result

def refresh_access_token(refresh_token):
    """Refresh access token using refresh token"""
    data = {
        'grant_type': 'refresh_token',
        'client_id': ZOHO_CLIENT_ID,
        'client_secret': ZOHO_CLIENT_SECRET,
        'refresh_token': refresh_token
    }
    
    response = requests.post(TOKEN_URL, data=data)
    return response.json()

def get_valid_access_token():
    """Get a valid access token, refreshing if necessary"""
    if 'access_token' not in zoho_tokens:
        return None
    
    # Check if token is expired (simple check - in production, track expiry time)
    access_token = zoho_tokens['access_token']
    
    # Try to use the token - if it fails, try to refresh
    try:
        # Test the token with a simple API call
        headers = {
            'Authorization': f'Zoho-oauthtoken {access_token}',
            'Content-Type': 'application/json'
        }
        
        test_url = f"{ZOHO_BASE_URL}/organizations"
        response = requests.get(test_url, headers=headers)
        
        if response.status_code == 401 and 'refresh_token' in zoho_tokens:
            # Token expired, try to refresh
            print("Access token expired, refreshing...")
            refresh_response = refresh_access_token(zoho_tokens['refresh_token'])
            
            if 'access_token' in refresh_response:
                zoho_tokens['access_token'] = refresh_response['access_token']
                if 'refresh_token' in refresh_response:
                    zoho_tokens['refresh_token'] = refresh_response['refresh_token']
                return refresh_response['access_token']
            else:
                print(f"Failed to refresh token: {refresh_response}")
                return None
        elif response.status_code == 200:
            return access_token
        else:
            print(f"Token validation failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"Error validating token: {e}")
        return None

def make_zoho_api_request(endpoint, organization_id, params=None):
    """Make authenticated request to Zoho Books API"""
    access_token = get_valid_access_token()
    if not access_token:
        return {'error': 'Not authenticated or token expired'}
    
    headers = {
        'Authorization': f'Zoho-oauthtoken {access_token}',
        'Content-Type': 'application/json'
    }
    
    url_params = {'organization_id': organization_id}
    if params:
        url_params.update(params)
    
    url = f"{ZOHO_BASE_URL}/{endpoint}?{urllib.parse.urlencode(url_params)}"
    
    try:
        response = requests.get(url, headers=headers)
        return response.json()
    except Exception as e:
        return {'error': str(e)}

def get_organizations():
    """Get list of organizations"""
    access_token = get_valid_access_token()
    if not access_token:
        return {'error': 'Not authenticated'}
    
    headers = {
        'Authorization': f'Zoho-oauthtoken {access_token}',
        'Content-Type': 'application/json'
    }
    
    url = f"{ZOHO_BASE_URL}/organizations"
    try:
        response = requests.get(url, headers=headers)
        return response.json()
    except Exception as e:
        return {'error': str(e)}

def get_expenses(organization_id, date_start=None, date_end=None):
    """Get expenses for a date range"""
    params = {}
    if date_start:
        params['date_start'] = date_start
    if date_end:
        params['date_end'] = date_end
    
    return make_zoho_api_request('expenses', organization_id, params)

def process_pl_data(organization_id, month_year):
    """Process P&L data for a specific month/year"""
    try:
        # Parse month/year (e.g., "July 2025")
        date_obj = datetime.strptime(month_year, "%B %Y")
        
        # Calculate date range for the month
        start_date = date_obj.replace(day=1)
        if date_obj.month == 12:
            end_date = date_obj.replace(year=date_obj.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            end_date = date_obj.replace(month=date_obj.month + 1, day=1) - timedelta(days=1)
        
        date_start = start_date.strftime('%Y-%m-%d')
        date_end = end_date.strftime('%Y-%m-%d')
        
        print(f"Processing P&L data for {month_year} ({date_start} to {date_end})")
        
        # Get expenses for the date range
        expenses_response = get_expenses(organization_id, date_start, date_end)
        if 'error' in expenses_response:
            return expenses_response
        if expenses_response.get('code') != 0:
            return {'error': f"Failed to get expenses: {expenses_response.get('message')}"}
        
        expenses = expenses_response.get('expenses', [])
        
        # Process the data to extract P&L components
        cogs = 0
        operating_expenses = 0
        rent_expense = 0
        operating_expense_details = {}
        
        # Process expenses
        for expense in expenses:
            account_name = expense.get('account_name', '').strip()
            amount = float(expense.get('total', 0))
            
            if amount <= 0:
                continue
            
            # Skip totals and payroll-related expenses
            if (account_name.lower().startswith('total') or 
                'salaries' in account_name.lower() or 
                'employee wages' in account_name.lower() or
                'payroll' in account_name.lower()):
                print(f"Skipping: {account_name}")
                continue
            
            # Categorize expenses
            if 'cost of goods sold' in account_name.lower() or 'cogs' in account_name.lower():
                cogs += amount
                print(f"COGS: {account_name} = ${amount:,.2f}")
            elif 'rent' in account_name.lower():
                rent_expense += amount
                operating_expense_details['Rent Expense'] = amount
                operating_expenses += amount
                print(f"Rent: {account_name} = ${amount:,.2f}")
            else:
                operating_expense_details[account_name] = amount
                operating_expenses += amount
                print(f"Operating Expense: {account_name} = ${amount:,.2f}")
        
        return {
            'month_year': month_year,
            'cogs': cogs,
            'operating_expenses': operating_expenses,
            'operating_expense_details': operating_expense_details,
            'rent_expense': rent_expense,
            'total_expenses_processed': len(expenses)
        }
        
    except Exception as e:
        print(f"Error processing P&L data: {e}")
        return {'error': str(e)}

# Flask Routes

# Google Sheets Payroll Routes (unchanged)
@app.route('/api/payroll', methods=['GET'])
def get_all_payroll_data():
    """API endpoint to get all payroll data."""
    try:
        tabs = get_sheet_tabs()
        print(f"Found {len(tabs)} data tabs: {tabs}")
        
        payroll_data = {}
        
        for tab_name in tabs:
            print(f"Processing tab: {tab_name}")
            data = get_payroll_data_from_tab(tab_name)
            
            # Use tab name as month/year (e.g., "June 2025")
            month_year = tab_name.strip()
            payroll_data[month_year] = {
                'payroll': data['total_payroll'],
                'active_staff': data['active_staff']
            }
            
            print(f"  Total Payroll: ฿{data['total_payroll']:,.2f}")
            print(f"  Active Staff: {data['active_staff']}")
        
        return jsonify({
            'success': True,
            'data': payroll_data
        })
        
    except Exception as e:
        print(f"Error in API endpoint: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Improved Zoho Books Routes
@app.route('/api/zoho/exchange-code', methods=['POST'])
def exchange_auth_code():
    """Exchange authorization code received from localhost callback"""
    try:
        data = request.get_json()
        auth_code = data.get('code')
        
        if not auth_code:
            return jsonify({
                'success': False,
                'error': 'No authorization code provided'
            }), 400
        
        print(f"Received auth code from localhost: {auth_code}")
        
        # Exchange code for token
        token_response = exchange_code_for_token(auth_code)
        print(f"Token response: {token_response}")
        
        if 'access_token' in token_response:
            # Store tokens securely
            zoho_tokens['access_token'] = token_response['access_token']
            if 'refresh_token' in token_response:
                zoho_tokens['refresh_token'] = token_response['refresh_token']
            
            print("Zoho Books authentication successful!")
            return jsonify({
                'success': True,
                'message': 'Successfully connected to Zoho Books',
                'token_info': {
                    'expires_in': token_response.get('expires_in'),
                    'scope': token_response.get('scope')
                }
            })
        else:
            error_msg = token_response.get('error', 'Failed to get access token')
            print(f"Token exchange failed: {error_msg}")
            return jsonify({
                'success': False,
                'error': error_msg,
                'details': token_response
            }), 400
            
    except Exception as e:
        print(f"Error in code exchange: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/zoho/connect', methods=['GET'])
def connect_zoho():
    """Get OAuth authorization URL for localhost callback"""
    auth_url = get_authorization_url()
    print(f"Generated Zoho OAuth URL: {auth_url}")
    return jsonify({
        'success': True,
        'auth_url': auth_url,
        'message': 'Open this URL to authorize Zoho Books access'
    })

@app.route('/api/zoho/callback', methods=['GET'])
def oauth_callback():
    """Handle OAuth callback and complete the flow server-side"""
    auth_code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        error_description = request.args.get('error_description', 'Unknown error')
        print(f"OAuth error: {error} - {error_description}")
        return redirect(f"{FRONTEND_URL}?zoho_error={urllib.parse.quote(error_description)}")
    
    if not auth_code:
        print("No authorization code received")
        return redirect(f"{FRONTEND_URL}?zoho_error=No authorization code received")
    
    print(f"Received auth code: {auth_code}")
    
    # Exchange code for token
    token_response = exchange_code_for_token(auth_code)
    print(f"Token response: {token_response}")
    
    if 'access_token' in token_response:
        # Store tokens securely (in production, use a database)
        zoho_tokens['access_token'] = token_response['access_token']
        if 'refresh_token' in token_response:
            zoho_tokens['refresh_token'] = token_response['refresh_token']
        
        print("Zoho Books authentication successful!")
        return redirect(f"{FRONTEND_URL}?zoho_success=true")
    else:
        error_msg = token_response.get('error', 'Failed to get access token')
        print(f"Token exchange failed: {error_msg}")
        return redirect(f"{FRONTEND_URL}?zoho_error={urllib.parse.quote(error_msg)}")

@app.route('/api/zoho/status', methods=['GET'])
def zoho_status():
    """Check Zoho Books authentication status"""
    access_token = get_valid_access_token()
    
    if access_token:
        # Get organizations to verify connection
        orgs_response = get_organizations()
        if 'error' not in orgs_response and orgs_response.get('code') == 0:
            organizations = orgs_response.get('organizations', [])
            return jsonify({
                'success': True,
                'authenticated': True,
                'organizations': len(organizations),
                'org_names': [org.get('name', 'Unknown') for org in organizations[:3]]  # First 3 org names
            })
    
    return jsonify({
        'success': True,
        'authenticated': False
    })

@app.route('/api/zoho/expenses/<month_year>', methods=['GET'])
def get_pl_data(month_year):
    """Get P&L data for a specific month"""
    access_token = get_valid_access_token()
    if not access_token:
        return jsonify({
            'success': False,
            'error': 'Not authenticated. Please connect to Zoho Books first.',
            'auth_required': True
        }), 401
    
    # Get organization ID from query params or use the first available
    organization_id = request.args.get('organization_id')
    
    if not organization_id:
        # Get the first organization automatically
        orgs_response = get_organizations()
        if 'error' in orgs_response or orgs_response.get('code') != 0:
            return jsonify({
                'success': False,
                'error': 'Failed to get organizations'
            }), 500
        
        organizations = orgs_response.get('organizations', [])
        if not organizations:
            return jsonify({
                'success': False,
                'error': 'No organizations found in Zoho Books'
            }), 404
        
        organization_id = organizations[0]['organization_id']
        print(f"Using organization: {organizations[0].get('name', 'Unknown')} (ID: {organization_id})")
    
    # Decode month_year from URL
    month_year = urllib.parse.unquote(month_year)
    
    # Process P&L data
    pl_data = process_pl_data(organization_id, month_year)
    
    if 'error' in pl_data:
        return jsonify({
            'success': False,
            'error': pl_data['error']
        }), 500
    
    return jsonify({
        'success': True,
        'data': pl_data
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """General health check endpoint"""
    access_token = get_valid_access_token()
    
    return jsonify({
        'status': 'healthy',
        'services': {
            'google_sheets_payroll': 'available',
            'zoho_books_expenses': 'available'
        },
        'zoho_authenticated': access_token is not None,
        'zoho_tokens_stored': len(zoho_tokens) > 0
    })

if __name__ == '__main__':
    print("Starting Combined P&L API server with improved OAuth...")
    print(f"Google Sheets Spreadsheet ID: {SPREADSHEET_ID}")
    print(f"Zoho Books Client ID: {ZOHO_CLIENT_ID}")
    print(f"Zoho Redirect URI: {ZOHO_REDIRECT_URI}")
    print(f"Frontend URL: {FRONTEND_URL}")
    print("Available endpoints:")
    print("  /api/payroll - Google Sheets payroll data")
    print("  /api/zoho/connect - Zoho Books OAuth initiation (server-side)")
    print("  /api/zoho/status - Check Zoho Books authentication status")
    print("  /api/zoho/expenses/<month> - Zoho Books expenses data")
    print("  /api/health - Health check")
    
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

