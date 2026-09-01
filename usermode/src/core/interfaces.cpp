#include "pch.hpp"

bool i::setup()
{
	bool success = true;
	const auto [client_base, client_size] = m_memory->get_module_info(CLIENT_DLL);
	if (!client_base.has_value() || !client_size.has_value())
		return {};

	auto try_rip = [&](const char* mod, const char* pat) -> std::optional<c_address> {
		auto a = m_memory->find_pattern(mod, pat);
		if (a.has_value()) return a->rip();
		return std::nullopt;
	};

	auto schema_pat = try_rip(SCHEMASYSTEM_DLL, GET_SCHEMA_SYSTEM);
	if (schema_pat.has_value()) m_schema_system = schema_pat->as<c_schema_system*>();
	else m_schema_system = nullptr;
	success &= (m_schema_system != nullptr);
	if (!m_schema_system) LOG_ERROR("schema pattern failed", 0);

	auto gv_pat = try_rip(CLIENT_DLL, GET_GLOBAL_VARS);
	if (!gv_pat.has_value()) gv_pat = try_rip(CLIENT_DLL, GET_GLOBAL_VARS_ALT);
	if (gv_pat.has_value()) m_global_vars = m_memory->read_t<c_global_vars*>(gv_pat->as<c_global_vars*>());
	else m_global_vars = m_memory->read_t<c_global_vars*>(client_base.value() + offsets::dwGlobalVars);
	success &= (m_global_vars != nullptr);
	if (!m_global_vars) LOG_ERROR("globalvars failed", 0);

	auto ent_pat = try_rip(CLIENT_DLL, GET_ENTITY_LIST);
	if (!ent_pat.has_value()) ent_pat = try_rip(CLIENT_DLL, GET_ENTITY_LIST_ALT);
	if (ent_pat.has_value()) m_game_entity_system = m_memory->read_t<c_game_entity_system*>(ent_pat->as<c_game_entity_system*>());
	else m_game_entity_system = m_memory->read_t<c_game_entity_system*>(client_base.value() + offsets::dwGameEntitySystem);
	success &= (m_game_entity_system != nullptr);
	if (!m_game_entity_system) LOG_ERROR("entity system failed - offsets.json fallback used", 0);

	return success;
}