from api.stdin_util import normalize_stdin


def test_normalize_empty():
    assert normalize_stdin("") == ""
    assert normalize_stdin("(none)") == ""


def test_normalize_literal_backslash_n():
    assert normalize_stdin("4\\n5") == "4\n5\n"


def test_normalize_adds_trailing_newline():
    assert normalize_stdin("Alice") == "Alice\n"
    assert normalize_stdin("4\n5") == "4\n5\n"
