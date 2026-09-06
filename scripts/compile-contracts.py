from pathlib import Path
import py_compile
for path in Path("contracts").glob("*.py"):
    py_compile.compile(str(path), doraise=True)
    print(f"compiled {path}")
