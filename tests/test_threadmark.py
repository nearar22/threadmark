import json

CONTRACT = "contracts/threadmark.py"
URL = "https://raw.githubusercontent.com/nearar22/intent-lock/f8cc2d08fd4a91b0450d60e065e5c507cdfd7c99/README.md"
SOURCE = "IntentLock catches the harder case: two agents, two request IDs, and two differently worded instructions that would cause the same economic or real-world effect."
QUOTE = "two agents, two request IDs, and two differently worded instructions"


def pin(vm, contract, board="desk-one", node="root-one", url=URL, text=SOURCE, quote=QUOTE):
    vm.mock_web(url, {"method": "GET", "status": 200, "body": text})
    return contract.pin_source(board, node, url, 1, 1, quote)


def verdict(vm, classification):
    vm.mock_llm("THREADMARK_PRODUCER", json.dumps(json.dumps({"verdict": classification})))


def test_pinned_source_receipt_and_transitive_trace(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    contract.create_board("desk-one", "Agent evidence trail")
    pin(direct_vm, contract)
    direct_vm.clear_mocks()
    verdict(direct_vm, "ENTAILED")
    contract.derive("desk-one", "claim-one", ["root-one"], "The source describes two agents with differently worded requests.")
    direct_vm.clear_mocks()
    verdict(direct_vm, "ENTAILED")
    contract.derive("desk-one", "claim-two", ["claim-one"], "The described requests use different wording.")
    node = contract.get_node("desk-one", "claim-two")
    trail = contract.trace("desk-one", "claim-two")
    assert node["status"] == "SUPPORTED" and node["depth"] == 2
    assert {x["id"] for x in trail} == {"root-one", "claim-one", "claim-two"}
    assert len(trail[-1]["source"]["sha256"]) == 64
    assert trail[-1]["source"]["url"] == URL


def test_untrusted_url_and_forged_quote_fail_closed(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    contract.create_board("desk-one", "Agent evidence trail")
    with direct_vm.expect_revert("pinned raw GitHub file"):
        contract.pin_source("desk-one", "bad-host", "https://raw.githubusercontent.com.evil.test/x", 1, 1, QUOTE)
    with direct_vm.expect_revert("full commit SHA"):
        contract.pin_source("desk-one", "bad-ref", "https://raw.githubusercontent.com/nearar22/intent-lock/main/README.md", 1, 1, QUOTE)
    direct_vm.mock_web(URL, {"method": "GET", "status": 200, "body": SOURCE})
    with direct_vm.expect_revert("Quote is absent"):
        contract.pin_source("desk-one", "bad-quote", URL, 1, 1, "This sentence was never in the source")
    assert contract.list_nodes("desk-one") == []


def test_validator_rejects_changed_source_snapshot(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    contract.create_board("desk-one", "Agent evidence trail")
    pin(direct_vm, contract)
    direct_vm.clear_mocks()
    direct_vm.mock_web(URL, {"method": "GET", "status": 200, "body": SOURCE + " altered"})
    assert direct_vm.run_validator() is False
    direct_vm.clear_mocks()


def test_authorization_duplicate_and_cross_board_guards(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    contract.create_board("desk-one", "Agent evidence trail")
    contract.create_board("desk-two", "Another evidence trail")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("authorized author"):
        pin(direct_vm, contract)
    direct_vm.clear_mocks()
    direct_vm.sender = direct_alice
    pin(direct_vm, contract)
    direct_vm.clear_mocks()
    with direct_vm.expect_revert("Node ID already exists"):
        pin(direct_vm, contract)
    with direct_vm.expect_revert("Parent is not on this board"):
        contract.derive("desk-two", "claim-one", ["root-one"], "This statement is not available on the second board.")


def test_broken_inference_cannot_be_reused(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    contract.create_board("desk-one", "Agent evidence trail")
    pin(direct_vm, contract)
    direct_vm.clear_mocks()
    verdict(direct_vm, "UNSUPPORTED")
    contract.derive("desk-one", "bad-claim", ["root-one"], "The source proves that every agent action is safe.")
    direct_vm.clear_mocks()
    assert contract.get_node("desk-one", "bad-claim")["status"] == "BROKEN"
    with direct_vm.expect_revert("Broken threads"):
        contract.derive("desk-one", "child-claim", ["bad-claim"], "This new claim inherits the unsupported statement.")


def test_validator_rejects_forged_semantic_classification(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    contract.create_board("desk-one", "Agent evidence trail")
    pin(direct_vm, contract)
    direct_vm.clear_mocks()
    verdict(direct_vm, "ENTAILED")
    contract.derive("desk-one", "claim-one", ["root-one"], "The source describes two agents with differently worded requests.")
    direct_vm.clear_mocks()
    verdict(direct_vm, "UNSUPPORTED")
    direct_vm._gl_call_hook = lambda _vm, request: {"ok": False} if "ExecPromptTemplate" in request else None
    assert direct_vm.run_validator() is False
    direct_vm._gl_call_hook = None


def test_malformed_verdict_and_duplicate_parents_rejected(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    contract.create_board("desk-one", "Agent evidence trail")
    pin(direct_vm, contract)
    direct_vm.clear_mocks()
    with direct_vm.expect_revert("Duplicate parent"):
        contract.derive("desk-one", "double", ["root-one", "root-one"], "The same source should not be counted as two parents.")
    direct_vm.mock_llm("THREADMARK_PRODUCER", json.dumps(json.dumps({"verdict": "ENTAILED", "score": 100})))
    with direct_vm.expect_revert("only its classification"):
        contract.derive("desk-one", "malformed", ["root-one"], "The source describes differently worded agent requests.")
