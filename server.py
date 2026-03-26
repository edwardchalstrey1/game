import os
import glob
import sys
import subprocess
import tempfile
import re
import traceback
from flask import Flask, jsonify, request
from flask_cors import CORS
import pygambit as gbt
from draw_tree import generate_svg
import multiprocessing
from google import genai

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "game_data")

RUNNING_TASKS = {}


def solver_worker(code, algorithm, queue):
    try:
        # Execute the code to get the 'game' object
        local_scope = {}
        # Inject gbt into globals to support code that assumes 'import pygambit as gbt' or uses gbt directly
        exec(code, {"gbt": gbt}, local_scope)
        game = local_scope.get("game")

        if game is None:
            game = local_scope.get("g")

        if not isinstance(game, gbt.Game):
            queue.put(
                {
                    "error": "Code did not produce a 'game' variable of type pygambit.Game"
                }
            )
            return

        # Select and run the solver
        solvers = {
            "enumpure": gbt.nash.enumpure_solve,
            "enummixed": gbt.nash.enummixed_solve,
            "lp": gbt.nash.lp_solve,
            "lcp": gbt.nash.lcp_solve,
            "liap": gbt.nash.liap_solve,
            "logit": gbt.nash.logit_solve,
            "simpdiv": gbt.nash.simpdiv_solve,
            "ipa": gbt.nash.ipa_solve,
            "gnm": gbt.nash.gnm_solve,
        }
        solver = solvers.get(algorithm)
        if not solver:
            queue.put({"error": f"Unknown algorithm: {algorithm}"})
            return

        solver_output = solver(game)

        # External solvers return a result object with an .equilibria attribute.
        # Internal python solvers can return a list of profiles, or a single profile.
        if hasattr(solver_output, "equilibria"):
            equilibria = solver_output.equilibria
        elif isinstance(solver_output, list):
            equilibria = solver_output
        else:  # Assuming a single NashProfile object was returned
            equilibria = [solver_output]

        results = "\n".join([f"NE {i + 1}: {eq}" for i, eq in enumerate(equilibria)])
        queue.put({"results": results or "No equilibria found by this solver."})

    except Exception as e:
        queue.put({"error": str(e)})


def extract_python_blocks(text_content):
    """
    Extract the code from Python blocks in a text string.
    """
    # Find all code blocks between ```python and ```
    pattern = r"```python\n(.*?)\n```"
    return re.findall(pattern, text_content, re.DOTALL)


def clean_python_code(code):
    """
    Remove any lines that write/save the game to file and trailing blank lines.
    """
    lines = code.split("\n")
    filtered_lines = []
    for line in lines:
        # Skip lines that contain write, save, or export operations
        stripped = line.strip()
        if not any(
            x in stripped
            for x in [
                "g.write(",
                ".write(",
                "g.save(",
                ".save(",
                "efg = ",
                "export",
                ".to_file",
                ".dump",
                "# Save the EFG",
            ]
        ):
            filtered_lines.append(line)

    # Remove trailing blank lines
    while filtered_lines and not filtered_lines[-1].strip():
        filtered_lines.pop()

    return "\n".join(filtered_lines)


def extract_second_python_code_block(text_content):
    """
    Extract Python code from a text file that contains formatted Python code blocks.
    Only uses the second code block which contains the main game creation script.
    """
    matches = extract_python_blocks(text_content)

    # Use only the second code block (index 1)
    if len(matches) >= 2:
        code = matches[1]
    elif len(matches) == 1:
        code = matches[0]
    else:
        return ""

    return clean_python_code(code)


def find_output_directory(game_id, output_base_path):
    """
    Find the 'Correct' directory for a given game.
    Handles directory name conversions from dataset pathnames to output directory names.
    """
    # Convert underscores to spaces
    game_dir_name = game_id.replace("_", " ")

    # Handle special cases
    # Nim (with_five_in_one_pile) -> Nim (with 5 in one pile)
    if "five" in game_dir_name.lower():
        game_dir_name = game_dir_name.replace("five", "5")

    candidate_dir = os.path.join(output_base_path, game_dir_name, "Correct")

    if os.path.exists(candidate_dir):
        return candidate_dir

    # If not found, try listing available directories and do a fuzzy match
    output_parent = output_base_path
    if os.path.exists(output_parent):
        available_dirs = [
            d
            for d in os.listdir(output_parent)
            if os.path.isdir(os.path.join(output_parent, d))
        ]

        # Try to find a matching directory (case-insensitive, ignoring punctuation)
        normalized_game_name = (
            game_dir_name.lower()
            .replace("-", " ")
            .replace(",", "")
            .replace("(", "")
            .replace(")", "")
        )
        for dir_name in available_dirs:
            normalized_dir = (
                dir_name.lower()
                .replace("-", " ")
                .replace(",", "")
                .replace("(", "")
                .replace(")", "")
            )
            if (
                normalized_game_name in normalized_dir
                or normalized_dir in normalized_game_name
            ):
                candidate_dir = os.path.join(output_parent, dir_name, "Correct")
                if os.path.exists(candidate_dir):
                    return candidate_dir

    return None


def get_dataset_games():
    """
    Load games from GameInterpreter/Dataset and their corresponding Python code
    from GameInterpreter/Output/Setting D/GPT-4o
    """
    games = []
    base_path = os.path.join(BASE_DIR, "GameInterpreter")

    # Check both Imperfect and Perfect Information games
    game_types = [
        ("Imperfect Information Games", "Imperfect Information Games"),
        ("Perfect Information Games", "Perfect Information Games"),
    ]

    for dataset_subdir, output_subdir in game_types:
        dataset_path = os.path.join(base_path, "Dataset", dataset_subdir)
        output_base_path = os.path.join(
            base_path, "Output", "Setting D", "GPT-4o", output_subdir
        )

        if not os.path.exists(dataset_path):
            continue

        # List all .txt files in the dataset
        dataset_files = glob.glob(os.path.join(dataset_path, "*.txt"))

        for desc_file in dataset_files:
            # Get game filename without extension
            filename = os.path.basename(desc_file)
            game_id = os.path.splitext(filename)[0]

            # Read description
            with open(desc_file, "r") as f:
                description = f.read()

            # Extract Python code from the output files
            code_variants = []
            output_dir = find_output_directory(game_id, output_base_path)

            if output_dir:
                try:
                    # Find all txt files
                    txt_files = glob.glob(os.path.join(output_dir, "*.txt"))
                    # Sort numerically if possible (e.g. 1.txt, 2.txt)
                    txt_files.sort(
                        key=lambda f: (
                            int(os.path.splitext(os.path.basename(f))[0])
                            if os.path.splitext(os.path.basename(f))[0].isdigit()
                            else os.path.basename(f)
                        )
                    )

                    for txt_file in txt_files:
                        with open(txt_file, "r") as f:
                            output_content = f.read()
                            extracted = extract_second_python_code_block(output_content)
                            if extracted:
                                code_variants.append(extracted)
                except Exception as e:
                    print(f"Error reading from {output_dir}: {e}", file=sys.stderr)

            # Only add game if we found at least one code variant
            if code_variants:
                # Use the directory name as the display name (convert underscores to spaces)
                display_name = game_id.replace("_", " ")
                games.append(
                    {
                        "id": game_id,
                        "name": display_name,
                        "description": description,
                        "mockCode": code_variants[0],
                        "codeVariants": code_variants,
                        "nashOutput": "Select an algorithm to compute.",
                    }
                )

    return games


@app.route("/generate", methods=["POST"])
def generate_code():
    data = request.json
    prompt = data.get("prompt")
    service = data.get("service", "gemini")
    model = data.get("model", "gemini-2.5-flash")
    setting = data.get("setting", "A")

    if service != "gemini":
        return jsonify(
            {"error": f"Service '{service}' not currently implemented."}
        ), 400

    if genai is None:
        return jsonify(
            {
                "error": "The 'google-genai' library is missing. Please install it (pip install google-genai)."
            }
        ), 500

    if not prompt:
        return jsonify({"error": "No prompt provided"}), 400

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return jsonify(
            {"error": "GEMINI_API_KEY not set. Please check your .env file."}
        ), 500

    client = genai.Client(api_key=api_key)

    settings = {}
    if setting == "A":
        settings[setting] = ""
        try:
            with open(
                os.path.join(
                    BASE_DIR,
                    "GameInterpreter",
                    "Prompts",
                    "Code_Generation_Initialization.txt",
                ),
                "r",
            ) as f:
                settings[setting] = f.read()
        except Exception as e:
            print(f"Error loading system instruction: {e}", file=sys.stderr)
    else:
        return jsonify(
            {"error": f"Setting '{setting}' not currently implemented."}
        ), 400

    system_instruction = settings[setting]
    full_prompt = f"{system_instruction}\n\nDescription: {prompt}"

    response = client.models.generate_content(model=model, contents=full_prompt)

    # Extract Python code blocks from the response
    extracted_blocks = extract_python_blocks(response.text)

    if not extracted_blocks:
        return jsonify({"error": "No Python code blocks found in the response"}), 400
    if len(extracted_blocks) > 1:
        print(
            "[WARNING] Multiple Python code blocks found. Using the first one.",
            file=sys.stderr,
        )

    cleaned_code = clean_python_code(extracted_blocks[0])
    return jsonify({"code": cleaned_code})


@app.route("/config", methods=["GET"])
def get_config():
    return jsonify({"gemini_enabled": bool(os.environ.get("GEMINI_API_KEY"))})


@app.route("/games", methods=["GET"])
def get_games():
    games = get_dataset_games()
    return jsonify(games)


@app.route("/visualization-settings", methods=["GET"])
def get_visualization_settings():
    """
    Get the default settings for game tree visualization.
    These correspond to the parameters available in draw_tree/generate_svg.
    """
    return jsonify(
        {
            "shared_terminal_depth": False,
            "scale_factor": 1.0,
            "level_scaling": 1.0,
            "sublevel_scaling": 1.0,
            "width_scaling": 1.0,
            "edge_thickness": 1.0,
            "action_label_position": 0.5,
            "color_scheme": "gambit",
        }
    )


@app.route("/visualize", methods=["POST"])
def visualize():
    data = request.json
    code = data.get("code", "")

    # Get visualization settings with defaults
    settings = {
        "shared_terminal_depth": data.get("shared_terminal_depth", False),
        "scale_factor": data.get("scale_factor", 1.0),
        "level_scaling": data.get("level_scaling", 1.0),
        "sublevel_scaling": data.get("sublevel_scaling", 1.0),
        "width_scaling": data.get("width_scaling", 1.0),
        "edge_thickness": data.get("edge_thickness", 1.0),
        "action_label_position": data.get("action_label_position", 0.5),
        "color_scheme": data.get("color_scheme", "gambit"),
    }

    try:
        # Execute the code to get the 'game' object
        local_scope = {}
        # Inject gbt into globals to support code that assumes 'import pygambit as gbt' or uses gbt directly
        exec(code, {"gbt": gbt}, local_scope)
        game = local_scope.get("game")

        if game is None:
            game = local_scope.get("g")

        if not isinstance(game, gbt.Game):
            return jsonify(
                {
                    "error": "Code did not produce a 'game' variable of type pygambit.Game"
                }
            ), 400

        # Generate visualization PDF using draw_tree with provided settings
        with tempfile.TemporaryDirectory() as tmpdir:
            svg_path = os.path.join(tmpdir, "tree.svg")

            # Generate PDF with visualization settings
            print(f"[DEBUG] Generating SVG at {svg_path}...", file=sys.stderr)
            generate_svg(
                game,
                shared_terminal_depth=settings["shared_terminal_depth"],
                scale_factor=settings["scale_factor"],
                level_scaling=settings["level_scaling"],
                sublevel_scaling=settings["sublevel_scaling"],
                width_scaling=settings["width_scaling"],
                edge_thickness=settings["edge_thickness"],
                action_label_position=settings["action_label_position"],
                color_scheme=settings["color_scheme"],
                save_to=svg_path,
            )
            with open(svg_path, "r") as svg_file:
                svg_content = svg_file.read()
            return jsonify({"svg": svg_content})

    except Exception as e:
        error_details = traceback.format_exc()
        print(f"[ERROR] Server error in /visualize:\n{error_details}", file=sys.stderr)
        return jsonify({"error": str(e), "details": error_details}), 500


@app.route("/compute-nash", methods=["POST"])
def compute_nash():
    data = request.json
    code = data.get("code", "")
    algorithm = data.get("algorithm", "enumpure")
    task_id = data.get("task_id")

    if not task_id:
        return jsonify({"error": "task_id is required"}), 400

    queue = multiprocessing.Queue()
    process = multiprocessing.Process(
        target=solver_worker, args=(code, algorithm, queue)
    )

    RUNNING_TASKS[task_id] = process
    process.start()
    process.join()

    # Cleanup
    if task_id in RUNNING_TASKS:
        del RUNNING_TASKS[task_id]

    if process.exitcode == 0:
        if not queue.empty():
            return jsonify(queue.get())
        else:
            return jsonify({"error": "Solver finished without output"}), 500
    else:
        return jsonify({"error": "Computation terminated by user"}), 400


@app.route("/kill-nash", methods=["POST"])
def kill_nash():
    data = request.json
    task_id = data.get("task_id")

    if task_id and task_id in RUNNING_TASKS:
        process = RUNNING_TASKS[task_id]
        if process.is_alive():
            process.terminate()
            return jsonify({"status": "terminated"})
        else:
            return jsonify({"status": "already_finished"})

    return jsonify({"error": "Task not found"}), 404


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
