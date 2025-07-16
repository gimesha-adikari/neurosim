from flask import Blueprint, request, redirect, render_template, session, url_for, flash
from werkzeug.security import generate_password_hash, check_password_hash
from cs50 import SQL

# Define a Flask Blueprint for authentication routes
auth = Blueprint("auth", __name__)

# Connect to SQLite database
db = SQL("sqlite:///neural_net.db")

# Route for user registration
@auth.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        # Check if username already exists
        if db.execute("SELECT * FROM users WHERE username = ?", username):
            return "Username already exists", 400

        # Hash the password and store new user
        hash = generate_password_hash(password)
        db.execute("INSERT INTO users (username, hash) VALUES (?, ?)", username, hash)

        return redirect(url_for("auth.login"))

    return render_template("register.html")

# Route for user login
@auth.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        # Fetch user data and validate password
        user = db.execute("SELECT * FROM users WHERE username = ?", username)
        if len(user) != 1 or not check_password_hash(user[0]["hash"], password):
            return "Invalid credentials", 403

        # Store user ID in session
        session["user_id"] = user[0]["id"]
        return redirect(url_for("index"))

    return render_template("login.html")

# Route for user logout
@auth.route("/logout")
def logout():
    session.clear()  # Clear session data
    return redirect(url_for("auth.login"))
