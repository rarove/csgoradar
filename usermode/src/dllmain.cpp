#include "pch.hpp"

bool main()
{
    config_data_t config_data = {};
    INIT_STEP("config system", cfg::setup(config_data));
    INIT_STEP("memory", m_memory->setup());
    INIT_STEP("interfaces", i::setup());
    INIT_STEP("schema", schema::setup());

    ix::initNetSystem();
    LOG_INFO("winsock initialization completed");

    std::string ip = config_data.m_ip;
    ip.erase(0, ip.find_first_not_of(" \t\r\n"));
    ip.erase(ip.find_last_not_of(" \t\r\n")+1);
    std::string formatted_address;
    if (ip.rfind("ws://",0)==0 || ip.rfind("wss://",0)==0) formatted_address = ip;
    else if (ip.find("onrender.com")!=std::string::npos || ip.find("ngrok")!=std::string::npos) {
        if (ip.find("/cs2_webradar")!=std::string::npos) formatted_address = std::format("wss://{}", ip.starts_with("https://")?ip.substr(8):ip.starts_with("http://")?ip.substr(7):ip);
        else formatted_address = std::format("wss://{}/cs2_webradar", ip);
        if (formatted_address.rfind("wss://wss://",0)==0) formatted_address = formatted_address.substr(6);
        if (formatted_address.rfind("wss://ws://",0)==0) formatted_address = "wss://" + formatted_address.substr(9);
    } else formatted_address = std::format("ws://{}:22006/cs2_webradar", ip);

    static ix::WebSocket web_socket;
    std::mutex handshake_mutex;
    std::condition_variable handshake_cv;
    bool connected = false;
    bool failed = false;

    web_socket.setUrl(formatted_address);
    web_socket.setOnMessageCallback([&](const ix::WebSocketMessagePtr& msg)
    {
        if (msg->type == ix::WebSocketMessageType::Open)
        {
            {
                std::lock_guard lock(handshake_mutex);
                connected = true;
            }
            handshake_cv.notify_one();
            LOG_INFO("connected to the web socket ('%s')", formatted_address.c_str());
        }
        else if (msg->type == ix::WebSocketMessageType::Error)
        {
            {
                std::lock_guard lock(handshake_mutex);
                failed = true;
            }
            handshake_cv.notify_one();
            LOG_ERROR("failed to connect to the web socket ('%s')", formatted_address.c_str());
        }
    });
    web_socket.start();

    {
        std::unique_lock lock(handshake_mutex);
        handshake_cv.wait(lock, [&] { return connected || failed; });
    }

    if (!connected)
    {
        std::this_thread::sleep_for(std::chrono::seconds(5));
        return {};
    }

    for (;;)
    {
        sdk::update();
        f::run();
        web_socket.send(f::m_data.dump());

        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    return true;
}