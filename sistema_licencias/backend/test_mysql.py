import pymysql

try:
    connection = pymysql.connect(host='localhost', user='root', password='', cursorclass=pymysql.cursors.DictCursor)
    with connection.cursor() as cursor:
        cursor.execute("SELECT VERSION()")
        result = cursor.fetchone()
        print("Connected to MySQL successfully!")
        print("Version:", result)
        
        # Also let's see if the database already exists
        cursor.execute("SHOW DATABASES")
        dbs = cursor.fetchall()
        print("Databases:", dbs)
except Exception as e:
    print("Error:", e)
